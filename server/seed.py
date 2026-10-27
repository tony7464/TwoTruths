"""Demo data. From the server folder:

    python seed.py
    python seed.py --if-empty
    python seed.py --guesses

The first command replaces every account. --if-empty does that only when
the database has no users, so setup can run twice without wiping data.
--guesses only clears guesses, messages, and scores. Demo login for every
seeded user: password123
"""

import sys

from app import app
from models import Guess, Message, Statement, User, db

PASSWORD = "password123"

PROFILES = [
    {
        "username": "alex",
        "bio": "Night-shift barista and weekend hiker.",
        "statements": [
            ("I have worked a 4 a.m. coffee shift.", False),
            ("I once hiked 14 miles by accident.", False),
            ("I have climbed Mount Everest.", True),
        ],
    },
    {
        "username": "jordan",
        "bio": "Bootcamp student who cooks to relax.",
        "statements": [
            ("I can make pasta from scratch.", False),
            ("I have a pet snake named Noodle.", True),
            ("I learned to code because of a broken laptop.", False),
        ],
    },
    {
        "username": "sam",
        "bio": "Plays pickup basketball and reads sci-fi.",
        "statements": [
            ("I have read Dune three times.", False),
            ("I was almost a marine biologist.", False),
            ("I dunked in a college game.", True),
        ],
    },
    {
        "username": "riley",
        "bio": "New on the team and always early.",
        "statements": [
            ("I wake up at 5:30 without an alarm.", False),
            ("I have visited 12 countries.", True),
            ("I met my best friend in a group project.", False),
        ],
    },
]


def seed():
    Message.query.delete()
    Guess.query.delete()
    Statement.query.delete()
    User.query.delete()

    for profile in PROFILES:
        user = User(username=profile["username"], bio=profile["bio"])
        user.password = PASSWORD
        for content, is_lie in profile["statements"]:
            user.statements.append(Statement(content=content, is_lie=is_lie))
        db.session.add(user)

    db.session.commit()
    print(f"Seeded {len(PROFILES)} users. Password: {PASSWORD}")


def reset_guesses():
    """Delete every guess and message, and set every score back to 0."""
    message_count = Message.query.delete()
    guess_count = Guess.query.delete()
    User.query.update({User.score: 0})
    db.session.commit()
    print(f"Removed {guess_count} guesses and {message_count} messages.")


def seed_if_empty():
    if User.query.first() is not None:
        print("Demo data is already there, so nothing was replaced.")
        return
    seed()


if __name__ == "__main__":
    with app.app_context():
        if "--guesses" in sys.argv[1:]:
            reset_guesses()
        elif "--if-empty" in sys.argv[1:]:
            seed_if_empty()
        else:
            seed()
