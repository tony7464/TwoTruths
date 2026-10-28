"""Profile bio edits and deleting an account."""

from app import app
from config import db
from models import Guess, Message, Statement, User
from test_rules import PASSWORD, add_statements, lie_id, sign_up, truth_id


def test_bio_can_be_set_and_cleared(client):
    sign_up(client, "casey")
    updated = client.patch("/api/profile", json={"bio": "  Night hiker  "})
    assert updated.status_code == 200
    body = updated.get_json()
    assert body["bio"] == "Night hiker"
    assert body["username"] == "casey"
    assert "statements_locked" in body
    assert "_password_hash" not in body

    exact = client.patch("/api/profile", json={"bio": "a" * 160})
    assert exact.status_code == 200
    assert exact.get_json()["bio"] == "a" * 160

    cleared = client.patch("/api/profile", json={"bio": ""})
    assert cleared.status_code == 200
    assert cleared.get_json()["bio"] == ""

    spaces = client.patch("/api/profile", json={"bio": "   "})
    assert spaces.status_code == 200
    assert spaces.get_json()["bio"] == ""
    assert client.get("/api/check_session").get_json()["bio"] == ""


def test_bio_too_long_is_rejected(client):
    sign_up(client, "casey")
    response = client.patch("/api/profile", json={"bio": "a" * 161})
    assert response.status_code == 400
    assert "error" in response.get_json()
    assert client.get("/api/check_session").get_json()["bio"] == "Hello"


def test_bio_must_be_text(client):
    sign_up(client, "casey")
    response = client.patch("/api/profile", json={"bio": 5})
    assert response.status_code == 400
    assert "error" in response.get_json()


def test_profile_and_account_require_login(client):
    assert client.patch("/api/profile", json={"bio": "Hi"}).status_code == 401
    assert client.delete("/api/account", json={"password": PASSWORD}).status_code == 401


def test_wrong_password_does_not_delete_and_counts_as_a_login_failure(client):
    sign_up(client, "casey")
    for _ in range(5):
        response = client.delete("/api/account", json={"password": "wrong-password"})
        assert response.status_code == 401
        assert "error" in response.get_json()
    still = client.get("/api/check_session").get_json()
    assert still["username"] == "casey"

    blocked = client.delete("/api/account", json={"password": PASSWORD})
    assert blocked.status_code == 429
    wait = int(blocked.headers["Retry-After"])
    assert 1 <= wait <= 60
    assert client.get("/api/check_session").get_json()["username"] == "casey"


def test_delete_account_removes_their_data_and_fixes_scores(client, other):
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
        "body": "Nice.",
    })
    assert sent.status_code == 201
    jordan_id = other.get("/api/check_session").get_json()["id"]
    reply = client.post("/api/messages", json={
        "recipient_id": jordan_id,
        "body": "Thanks.",
    })
    assert reply.status_code == 201

    stranger = app.test_client()
    sign_up(stranger, "sam")
    add_statements(stranger)

    removed = client.delete("/api/account", json={"password": PASSWORD})
    assert removed.status_code == 200
    assert removed.get_json()["message"] == "Account deleted."
    assert client.get("/api/check_session").get_json() == {"user": None}

    again = client.post("/api/login", json={"username": "alex", "password": PASSWORD})
    assert again.status_code == 401

    jordan = other.get("/api/check_session").get_json()
    assert jordan["username"] == "jordan"
    assert jordan["score"] == 0
    assert other.get("/api/messages").get_json() == []
    names = [profile["username"] for profile in other.get("/api/users").get_json()]
    assert "alex" not in names
    assert "sam" in names

    sam = stranger.get("/api/check_session").get_json()
    assert sam["username"] == "sam"
    assert sam["score"] == 0
    assert len(sam["statements"]) == 3

    other.delete("/api/logout")
    relogin = other.post("/api/login", json={"username": "jordan", "password": PASSWORD})
    assert relogin.status_code == 200

    with app.app_context():
        assert User.query.filter(db.func.lower(User.username) == "alex").first() is None
        assert Statement.query.filter_by(user_id=owner["id"]).count() == 0
        assert Guess.query.count() == 0
        assert Message.query.count() == 0
        assert User.query.filter(db.func.lower(User.username) == "sam").count() == 1
        assert User.query.filter(db.func.lower(User.username) == "jordan").first().score == 0


def test_deleting_the_guesser_leaves_the_profile(client, other):
    owner = sign_up(client, "alex")
    created = add_statements(client)
    sign_up(other, "jordan")
    guess = other.post("/api/guesses", json={
        "profile_user_id": owner["id"],
        "statement_id": truth_id(created),
    })
    assert guess.status_code == 201
    assert client.get("/api/check_session").get_json()["statements_locked"] is True

    removed = other.delete("/api/account", json={"password": PASSWORD})
    assert removed.status_code == 200

    owner_now = client.get("/api/check_session").get_json()
    assert owner_now["username"] == "alex"
    assert owner_now["score"] == 0
    assert owner_now["fooled_count"] == 0
    assert owner_now["statements_locked"] is False
    assert len(owner_now["statements"]) == 3

    again = other.post("/api/login", json={"username": "jordan", "password": PASSWORD})
    assert again.status_code == 401
