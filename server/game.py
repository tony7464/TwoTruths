"""Statement, guess, and message checks used by the routes."""

from config import db
from errors import error
from models import Guess, Statement, User
from validation import MAX_STATEMENT, clean_text


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
    if len(statements) != 3:
        return False
    lies = 0
    for statement in statements:
        if statement.is_lie:
            lies += 1
    return lies == 1


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


def user_by_name(username):
    return User.query.filter(db.func.lower(User.username) == username.lower()).first()
