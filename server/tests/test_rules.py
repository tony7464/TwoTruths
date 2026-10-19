"""One happy path and one rejection for each game rule.

From the server folder:

    ../.venv/bin/pytest
"""

from app import app

PASSWORD = "password123"

STATEMENTS = [
    {"content": "I like rain.", "is_lie": False},
    {"content": "I own a boat.", "is_lie": True},
    {"content": "I drink tea.", "is_lie": False},
]


def sign_up(client, username):
    response = client.post("/api/signup", json={
        "username": username,
        "password": PASSWORD,
        "bio": "Hello",
    })
    assert response.status_code == 201
    return response.get_json()


def add_statements(client):
    response = client.post("/api/statements", json={"statements": STATEMENTS})
    assert response.status_code == 201
    return response.get_json()


def lie_id(statements):
    return next(item["id"] for item in statements if item["is_lie"])


def truth_id(statements):
    return next(item["id"] for item in statements if not item["is_lie"])


def error_text(response):
    body = response.get_json()
    assert "error" in body
    return body["error"]


def current_user_id(client):
    return client.get("/api/check_session").get_json()["id"]


def test_signup_starts_a_session(client):
    user = sign_up(client, "casey")

    assert user["username"] == "casey"
    assert "_password_hash" not in user
    assert user["statements"] == []

    session = client.get("/api/check_session")
    assert session.status_code == 200
    assert session.get_json()["username"] == "casey"


def test_signup_rejects_a_short_password(client):
    response = client.post("/api/signup", json={
        "username": "casey",
        "password": "short",
    })

    assert response.status_code == 400
    assert "6" in error_text(response)


def test_signup_rejects_a_taken_username(client):
    sign_up(client, "casey")
    response = client.post("/api/signup", json={
        "username": "casey",
        "password": PASSWORD,
    })

    assert response.status_code == 409


def test_login_and_logout(client):
    sign_up(client, "casey")
    client.delete("/api/logout")

    bad = client.post("/api/login", json={
        "username": "casey",
        "password": "wrong-password",
    })
    assert bad.status_code == 401

    good = client.post("/api/login", json={
        "username": "casey",
        "password": PASSWORD,
    })
    assert good.status_code == 200
    assert "_password_hash" not in good.get_json()

    client.delete("/api/logout")
    assert client.get("/api/check_session").status_code == 401


def test_create_statements_with_one_lie(client):
    sign_up(client, "casey")
    created = add_statements(client)

    assert len(created) == 3
    assert sum(item["is_lie"] for item in created) == 1


def test_statements_need_exactly_one_lie(client):
    sign_up(client, "casey")
    bad = [
        {"content": "I like rain.", "is_lie": False},
        {"content": "I own a boat.", "is_lie": False},
        {"content": "", "is_lie": False},
    ]
    response = client.post("/api/statements", json={"statements": bad})

    assert response.status_code == 400
    assert error_text(response)


def test_owner_can_edit_before_anyone_guesses(client):
    sign_up(client, "casey")
    created = add_statements(client)
    truth = next(item for item in created if not item["is_lie"])

    response = client.patch(f"/api/statements/{truth['id']}", json={
        "content": "I like snow.",
        "is_lie": True,
    })

    assert response.status_code == 200
    assert response.get_json()["is_lie"] is True

    saved = client.get("/api/statements").get_json()
    assert sum(item["is_lie"] for item in saved) == 1
    assert any(item["content"] == "I like snow." for item in saved)


def test_only_the_owner_can_edit_or_delete(client, other):
    sign_up(client, "alex")
    created = add_statements(client)
    sign_up(other, "jordan")

    statement_id = created[0]["id"]
    edited = other.patch(f"/api/statements/{statement_id}", json={"content": "Nope."})
    deleted = other.delete(f"/api/statements/{statement_id}")

    assert edited.status_code == 404
    assert deleted.status_code == 404

    still_there = client.get("/api/statements").get_json()
    assert len(still_there) == 3


def test_statements_lock_after_a_guess(client, other):
    owner = sign_up(client, "alex")
    created = add_statements(client)
    sign_up(other, "jordan")

    guess = other.post("/api/guesses", json={
        "profile_user_id": owner["id"],
        "statement_id": truth_id(created),
    })
    assert guess.status_code == 201

    locked = client.patch(f"/api/statements/{created[0]['id']}", json={
        "content": "Changed after a guess.",
    })
    removed = client.delete(f"/api/statements/{created[0]['id']}")

    assert locked.status_code == 403
    assert removed.status_code == 403


def test_wrong_guess_is_final_and_blocks_messaging(client, other):
    owner = sign_up(client, "alex")
    created = add_statements(client)
    sign_up(other, "jordan")

    guess = other.post("/api/guesses", json={
        "profile_user_id": owner["id"],
        "statement_id": truth_id(created),
    })
    body = guess.get_json()

    assert guess.status_code == 201
    assert body["is_correct"] is False
    assert body["messaging_unlocked"] is False
    assert body["score"] == 0
    assert body["fooled_count"] == 1

    message = other.post("/api/messages", json={
        "recipient_id": owner["id"],
        "body": "Can I still say hi?",
    })
    assert message.status_code == 403

    again = other.post("/api/guesses", json={
        "profile_user_id": owner["id"],
        "statement_id": lie_id(created),
    })
    assert again.status_code == 409


def test_cannot_guess_your_own_profile(client):
    owner = sign_up(client, "alex")
    created = add_statements(client)

    response = client.post("/api/guesses", json={
        "profile_user_id": owner["id"],
        "statement_id": lie_id(created),
    })

    assert response.status_code == 403


def test_correct_guess_opens_the_thread_for_both_people(client, other):
    owner = sign_up(client, "alex")
    created = add_statements(client)
    guesser = sign_up(other, "jordan")

    guess = other.post("/api/guesses", json={
        "profile_user_id": owner["id"],
        "statement_id": lie_id(created),
    })
    body = guess.get_json()

    assert guess.status_code == 201
    assert body["is_correct"] is True
    assert body["messaging_unlocked"] is True
    assert body["score"] == 1
    assert body["fooled_count"] == 0

    sent = other.post("/api/messages", json={
        "recipient_id": owner["id"],
        "body": "I knew the boat one was a lie!",
    })
    assert sent.status_code == 201

    reply = client.post("/api/messages", json={
        "recipient_id": guesser["id"],
        "body": "You got me.",
    })
    assert reply.status_code == 201

    inbox = client.get("/api/messages")
    messages = inbox.get_json()
    assert [item["body"] for item in messages] == [
        "I knew the boat one was a lie!",
        "You got me.",
    ]


def test_a_stranger_cannot_message_or_see_the_thread(client, other):
    owner = sign_up(client, "alex")
    created = add_statements(client)
    sign_up(other, "jordan")
    other.post("/api/guesses", json={
        "profile_user_id": owner["id"],
        "statement_id": lie_id(created),
    })
    other.post("/api/messages", json={
        "recipient_id": owner["id"],
        "body": "Nice try on the boat.",
    })

    stranger = app.test_client()
    sign_up(stranger, "riley")
    blocked = stranger.post("/api/messages", json={
        "recipient_id": owner["id"],
        "body": "Let me in.",
    })
    assert blocked.status_code == 403

    self_message = other.post("/api/messages", json={
        "recipient_id": current_user_id(other),
        "body": "Hello me.",
    })
    assert self_message.status_code == 403

    hidden = stranger.get("/api/messages").get_json()
    assert hidden == []


def test_browse_hides_the_lie_until_you_guess(client, other):
    sign_up(client, "alex")
    add_statements(client)
    sign_up(other, "jordan")

    profiles = other.get("/api/users").get_json()
    alex = next(profile for profile in profiles if profile["username"] == "alex")

    assert alex["my_guess"] is None
    assert all("is_lie" not in statement for statement in alex["statements"])
    assert all(profile["username"] != "jordan" for profile in profiles)
