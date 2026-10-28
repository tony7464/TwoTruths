"""API for accounts, statements, guesses, and messages.

A route wrapped with login_required receives the logged-in user as its first argument.
"""

import re
from functools import wraps

from flask import request, session
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import RequestEntityTooLarge

from client_files import register_client_files
from config import app, db, debug_enabled
from errors import error, register_error_handlers
from game import (
    guess_for_viewer,
    locked_response,
    own_statement,
    revealed_guess,
    thread_is_open,
    user_by_name,
    valid_statement_set,
    validate_statement_set,
)
from limiter import (
    clear_login_failures,
    login_blocked,
    record_login_failure,
    record_signup_attempt,
    signup_blocked,
)
from models import Guess, Message, Statement, User, remove_user
from schemas import (
    messages_schema,
    owner_statement_schema,
    owner_statements_schema,
    owner_user_schema,
    public_user_schema,
)
from validation import (
    MAX_BIO,
    MAX_MESSAGE,
    MAX_STATEMENT,
    MIN_PASSWORD,
    USERNAME_PATTERN,
    clean_bio,
    clean_text,
    is_valid_text,
    parse_int,
    password_error,
)

register_error_handlers()


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return db.session.get(User, user_id)


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if not user:
            return error("Please log in.", 401)
        return view(user, *args, **kwargs)

    return wrapped


def _cache_chunked_body():
    # No Content-Length (chunked). Werkzeug stops at the cap without raising,
    # so a too-large body would look like bad JSON. Read one byte past the cap
    # and let the 413 handler answer.
    limit = request.max_content_length
    if limit is None or request.content_length is not None:
        return
    if not request.environ.get("wsgi.input_terminated"):
        return
    stream = request.environ["wsgi.input"]
    chunks = []
    remaining = limit + 1
    while remaining > 0:
        chunk = stream.read(remaining)
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    raw = b"".join(chunks)
    if len(raw) > limit:
        raise RequestEntityTooLarge()
    request._cached_data = raw


def json_body():
    try:
        _cache_chunked_body()
        data = request.get_json(silent=True)
    except RequestEntityTooLarge:
        raise
    except (RecursionError, ValueError):
        return None, error("Send a JSON object.", 400)
    if not isinstance(data, dict):
        return None, error("Send a JSON object.", 400)
    return data, None


@app.before_request
def reject_oversized_url_id():
    # Any method. A digit string SQLite cannot store must be 404, not a 500 or a 405.
    # Only ASCII digits: "²" and "١٢٣" pass str.isdigit() but are not int() values.
    # int() itself errors past 4300 digits, so a longer digit string is 404 first.
    for part in request.path.split("/"):
        if not re.fullmatch(r"[0-9]+", part):
            continue
        if len(part) > 19 or parse_int(int(part)) is None:
            return error("Not found.", 404)


# --- auth ---

@app.post("/api/signup")
def signup():
    data, err = json_body()
    if err:
        return err

    blocked = signup_blocked()
    if blocked:
        return blocked
    # Every call counts, including ones that fail validation.
    record_signup_attempt()

    username = data.get("username")
    password = data.get("password")
    if not isinstance(username, str):
        return error("Username must be text.", 400)
    problem = password_error(password)
    if problem:
        return error(problem, 400)
    if "bio" in data and not isinstance(data.get("bio"), str):
        return error("Bio must be text.", 400)

    username = username.strip()
    bio = data["bio"].strip() if isinstance(data.get("bio"), str) else ""
    if not is_valid_text(bio):
        return error("Bio must be text.", 400)
    if not is_valid_text(username):
        return error("Username must be text.", 400)
    if not USERNAME_PATTERN.fullmatch(username):
        return error("Username must be 3–20 letters, numbers, or underscores.", 400)
    if len(password) < MIN_PASSWORD:
        return error("Password must be at least 6 characters.", 400)
    if len(bio) > MAX_BIO:
        return error(f"Bio must be under {MAX_BIO} characters.", 400)
    if user_by_name(username):
        return error("That username is taken.", 409)

    user = User(username=username, bio=bio)
    user.password = password
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error("That username is taken.", 409)

    session.clear()
    session["user_id"] = user.id
    return owner_user_schema.dump(user), 201


@app.post("/api/login")
def login():
    data, err = json_body()
    if err:
        return err

    username = data.get("username")
    password = data.get("password")
    if not isinstance(username, str):
        return error("Username must be text.", 400)
    problem = password_error(password)
    if problem:
        return error(problem, 400)

    username = username.strip()
    # The limiter key lowercases the name. Reject a lone surrogate before that.
    if not is_valid_text(username):
        return error("Username must be text.", 400)
    blocked = login_blocked(username)
    if blocked:
        return blocked

    user = user_by_name(username)
    if not user or not user.authenticate(password):
        record_login_failure(username)
        return error("Username or password is incorrect.", 401)

    clear_login_failures(username)
    session.clear()
    session["user_id"] = user.id
    return owner_user_schema.dump(user)


@app.delete("/api/logout")
def logout():
    session.clear()
    return {"message": "Logged out."}


@app.get("/api/check_session")
def check_session():
    # Logged-out callers get 200 so the client can treat "no user" as a normal session check.
    # Other routes still use login_required and return 401.
    user = current_user()
    if not user:
        return {"user": None}
    return owner_user_schema.dump(user)


@app.get("/api/health")
def health():
    return {"ok": True}


# --- profiles ---

@app.get("/api/users")
@login_required
def list_users(user):
    profiles = User.query.filter(User.id != user.id).order_by(User.username).all()
    results = []
    for profile in profiles:
        if not valid_statement_set(profile):
            continue
        data = public_user_schema.dump(profile)
        data["my_guess"] = guess_for_viewer(user, profile)
        results.append(data)
    return results


@app.patch("/api/profile")
@login_required
def update_profile(user):
    data, err = json_body()
    if err:
        return err
    text, problem = clean_bio(data.get("bio"))
    if problem:
        return error(problem, 400)
    user.bio = text
    db.session.commit()
    return owner_user_schema.dump(user)


@app.delete("/api/account")
@login_required
def delete_account(user):
    data, err = json_body()
    if err:
        return err
    password = data.get("password")
    problem = password_error(password)
    if problem:
        return error(problem, 400)

    blocked = login_blocked(user.username)
    if blocked:
        return blocked
    if not user.authenticate(password):
        record_login_failure(user.username)
        return error("Password is incorrect.", 401)

    remove_user(user)
    db.session.commit()
    session.clear()
    return {"message": "Account deleted."}


# --- statements ---

@app.get("/api/statements")
@login_required
def list_my_statements(user):
    return owner_statements_schema.dump(user.statements)


@app.post("/api/statements")
@login_required
def create_statements(user):
    if user.statements:
        return error("You already have statements. Edit them instead.", 400)

    data, err = json_body()
    if err:
        return err
    items = data.get("statements")
    problem = validate_statement_set(items)
    if problem:
        return error(problem, 400)

    for item in items:
        db.session.add(Statement(
            content=item["content"],
            is_lie=item["is_lie"],
            user=user,
        ))
    db.session.commit()
    return owner_statements_schema.dump(user.statements), 201


@app.patch("/api/statements/<int:statement_id>")
@login_required
def update_statement(user, statement_id):
    data, err = json_body()
    if err:
        return err
    if "content" in data and not isinstance(data.get("content"), str):
        return error("Statement text is required and must be under 200 characters.", 400)
    if "is_lie" in data and not isinstance(data.get("is_lie"), bool):
        return error("is_lie must be true or false.", 400)

    statement, err = own_statement(user, statement_id)
    if err:
        return err

    if "content" in data:
        text, problem = clean_text(data.get("content"), MAX_STATEMENT)
        if problem:
            return error("Statement text is required and must be under 200 characters.", 400)
        statement.content = text

    if "is_lie" in data:
        if data.get("is_lie") is True:
            # This one becomes the only lie, so the set still has exactly one.
            for other in user.statements:
                other.is_lie = other.id == statement.id
        elif data.get("is_lie") is False:
            another_lie = any(
                other.is_lie and other.id != statement.id for other in user.statements
            )
            if statement.is_lie and not another_lie:
                return error("Exactly one statement must be the lie.", 400)
            statement.is_lie = False
        else:
            return error("is_lie must be true or false.", 400)

    db.session.commit()
    return owner_statement_schema.dump(statement)


@app.delete("/api/statements")
@login_required
def delete_statements(user):
    locked = locked_response(user)
    if locked:
        return locked

    for statement in list(user.statements):
        db.session.delete(statement)
    db.session.commit()
    return {"message": "Statements deleted."}


# --- guesses ---

@app.post("/api/guesses")
@login_required
def create_guess(user):
    data, err = json_body()
    if err:
        return err
    profile_user_id = parse_int(data.get("profile_user_id"))
    statement_id = parse_int(data.get("statement_id"))
    if profile_user_id is None or statement_id is None:
        return error("Choose a profile and a statement.", 400)

    if profile_user_id == user.id:
        return error("You cannot guess your own profile.", 403)

    profile = db.session.get(User, profile_user_id)
    if not profile:
        return error("Profile not found.", 404)

    statement = db.session.get(Statement, statement_id)
    if not statement or statement.user_id != profile.id:
        return error("That statement is not on this profile.", 400)
    if not valid_statement_set(profile):
        return error("That profile is not ready to guess.", 400)
    if Guess.query.filter_by(guesser_id=user.id, profile_user_id=profile.id).first():
        return error("You already guessed this profile.", 409)

    guess = Guess(
        guesser_id=user.id,
        profile_user_id=profile.id,
        statement_id=statement.id,
        is_correct=statement.is_lie,
    )
    if statement.is_lie:
        user.score += 1

    db.session.add(guess)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error("You already guessed this profile.", 409)

    payload = revealed_guess(guess, profile)
    # score belongs to the guesser (nav). profile_score and fooled_count belong to the card.
    payload["score"] = user.score
    payload["profile_score"] = profile.score
    payload["fooled_count"] = profile.fooled_count
    return payload, 201


# --- messages ---

@app.get("/api/messages")
@login_required
def list_messages(user):
    messages = Message.query.filter(
        db.or_(Message.sender_id == user.id, Message.recipient_id == user.id)
    ).order_by(Message.created_at).all()
    return messages_schema.dump(messages)


@app.post("/api/messages")
@login_required
def create_message(user):
    data, err = json_body()
    if err:
        return err

    body, problem = clean_text(data.get("body"), MAX_MESSAGE)
    if problem:
        return error("Message text is required and must be under 500 characters.", 400)

    recipient_id = parse_int(data.get("recipient_id"))
    if recipient_id is None:
        return error("Choose who should receive this message.", 400)
    if recipient_id == user.id:
        return error("You cannot message yourself.", 403)

    recipient = db.session.get(User, recipient_id)
    if not recipient:
        return error("Recipient not found.", 404)
    if not thread_is_open(user.id, recipient.id):
        return error("Guess their lie correctly before messaging.", 403)

    message = Message(sender=user, recipient=recipient, body=body)
    db.session.add(message)
    db.session.commit()
    return messages_schema.dump([message])[0], 201


register_client_files(app)


if __name__ == "__main__":
    app.run(port=5555, debug=debug_enabled())
