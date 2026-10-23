import re
from functools import wraps

from flask import request, session
from sqlalchemy.exc import IntegrityError

from config import app, db
from models import Guess, Message, Statement, User
from schemas import (
    messages_schema,
    owner_statement_schema,
    owner_statements_schema,
    owner_user_schema,
    public_user_schema,
)

USERNAME_PATTERN = re.compile(r"[A-Za-z0-9_]{3,20}")
MIN_PASSWORD = 6
MAX_BIO = 160
MAX_STATEMENT = 200
MAX_MESSAGE = 500


def error(message, status):
    return {"error": message}, status


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


def clean_text(value, limit):
    text = (value or "").strip()
    if not text:
        return None, "This field needs text."
    if len(text) > limit:
        return None, f"Keep it under {limit} characters."
    return text, None


def parse_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def locked_response(user):
    # A guess locks the set. Later edits would rewrite results people already saw.
    if user.statements_locked:
        return error("Your statements are locked because someone has guessed.", 403)
    return None


def own_statement(user, statement_id):
    statement = db.session.get(Statement, statement_id)
    if not statement or statement.user_id != user.id:
        return None, error("Statement not found.", 404)
    locked = locked_response(user)
    if locked:
        return None, locked
    return statement, None


def valid_statement_set(profile):
    statements = profile.statements
    return len(statements) == 3 and sum(statement.is_lie for statement in statements) == 1


def thread_is_open(user_a_id, user_b_id):
    # One correct guess, in either direction, opens messaging for both people.
    return Guess.query.filter(
        Guess.is_correct.is_(True),
        db.or_(
            db.and_(Guess.guesser_id == user_a_id, Guess.profile_user_id == user_b_id),
            db.and_(Guess.guesser_id == user_b_id, Guess.profile_user_id == user_a_id),
        ),
    ).first() is not None


def revealed_guess(guess, profile):
    lie = next(statement for statement in profile.statements if statement.is_lie)
    return {
        "is_correct": guess.is_correct,
        "statement_id": guess.statement_id,
        "messaging_unlocked": guess.is_correct,
        "lie": {"id": lie.id, "content": lie.content},
    }


def guess_for_viewer(viewer, profile):
    # Until this viewer guesses, the lie stays hidden. Then they see the lie they faced.
    guess = Guess.query.filter_by(guesser_id=viewer.id, profile_user_id=profile.id).first()
    if not guess:
        return None
    return revealed_guess(guess, profile)


def validate_statement_set(items):
    # Saved as a whole set: exactly three statements, exactly one of them the lie.
    if not isinstance(items, list) or len(items) != 3:
        return "Send exactly 3 statements."

    lie_count = 0
    for item in items:
        if not isinstance(item, dict):
            return "Each statement needs text and a lie flag."
        text, problem = clean_text(item.get("content"), MAX_STATEMENT)
        if problem:
            return "Every statement needs text under 200 characters."
        item["content"] = text
        if item.get("is_lie") is True:
            lie_count += 1
        elif item.get("is_lie") is not False:
            return "Mark each statement as a truth or the lie."

    if lie_count != 1:
        return "Mark exactly one statement as the lie."
    return None


# --- auth ---

@app.post("/api/signup")
def signup():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    bio = (data.get("bio") or "").strip()

    if not USERNAME_PATTERN.fullmatch(username):
        return error("Username must be 3–20 letters, numbers, or underscores.", 400)
    if len(password) < MIN_PASSWORD:
        return error("Password must be at least 6 characters.", 400)
    if len(bio) > MAX_BIO:
        return error(f"Bio must be under {MAX_BIO} characters.", 400)
    if User.query.filter_by(username=username).first():
        return error("That username is taken.", 409)

    user = User(username=username, bio=bio)
    user.password = password
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error("That username is taken.", 409)

    session["user_id"] = user.id
    return owner_user_schema.dump(user), 201


@app.post("/api/login")
def login():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    user = User.query.filter_by(username=username).first()

    if not user or not user.authenticate(password):
        return error("Username or password is incorrect.", 401)

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

    items = (request.get_json() or {}).get("statements")
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
    statement, err = own_statement(user, statement_id)
    if err:
        return err

    data = request.get_json() or {}

    if "content" in data:
        text, problem = clean_text(data.get("content"), MAX_STATEMENT)
        if problem:
            return error("Statement text is required and must be under 200 characters.", 400)
        statement.content = text

    if "is_lie" in data:
        if data.get("is_lie") is True:
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


@app.delete("/api/statements/<int:statement_id>")
@login_required
def delete_statement(user, statement_id):
    statement, err = own_statement(user, statement_id)
    if statement:
        return error(
            "Delete your whole set and write a new one; a profile needs exactly 3 statements.",
            400,
        )
    return err


# --- guesses ---

@app.post("/api/guesses")
@login_required
def create_guess(user):
    data = request.get_json() or {}
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
    data = request.get_json() or {}
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

    body, problem = clean_text(data.get("body"), MAX_MESSAGE)
    if problem:
        return error("Message text is required and must be under 500 characters.", 400)

    message = Message(sender=user, recipient=recipient, body=body)
    db.session.add(message)
    db.session.commit()
    return messages_schema.dump([message])[0], 201


if __name__ == "__main__":
    app.run(port=5555, debug=True)
