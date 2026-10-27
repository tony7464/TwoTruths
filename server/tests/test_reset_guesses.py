"""reset_guesses clears the game and leaves accounts and statements in place."""

from app import app
from models import Guess, Message, Statement, User
from seed import reset_guesses
from test_rules import PASSWORD, add_statements, lie_id, sign_up


def test_reset_guesses_keeps_accounts_and_unlocks_statements(client, other):
    owner = sign_up(client, "alex")
    created = add_statements(client)
    sign_up(other, "jordan")

    guess = other.post("/api/guesses", json={
        "profile_user_id": owner["id"],
        "statement_id": lie_id(created),
    })
    assert guess.status_code == 201
    assert guess.get_json()["score"] == 1

    sent = other.post("/api/messages", json={
        "recipient_id": owner["id"],
        "body": "Got you.",
    })
    assert sent.status_code == 201

    with app.app_context():
        reset_guesses()
        assert Guess.query.count() == 0
        assert Message.query.count() == 0
        users = User.query.order_by(User.username).all()
        assert [user.username for user in users] == ["alex", "jordan"]
        assert [user.score for user in users] == [0, 0]
        statements = Statement.query.filter_by(user_id=owner["id"]).all()
        assert len(statements) == 3
        assert sum(item.is_lie for item in statements) == 1

    owner_now = client.get("/api/check_session").get_json()
    assert owner_now["username"] == "alex"
    assert owner_now["bio"] == "Hello"
    assert owner_now["score"] == 0
    assert owner_now["statements_locked"] is False
    assert len(owner_now["statements"]) == 3
    assert client.get("/api/messages").get_json() == []

    client.delete("/api/logout")
    logged_in = client.post("/api/login", json={
        "username": "alex",
        "password": PASSWORD,
    })
    assert logged_in.status_code == 200

    again = other.post("/api/guesses", json={
        "profile_user_id": owner["id"],
        "statement_id": lie_id(created),
    })
    assert again.status_code == 201
