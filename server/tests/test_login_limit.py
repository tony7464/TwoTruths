"""Login slows down after repeated failures, and a success clears that count."""

from test_rules import PASSWORD, sign_up

from config import app, debug_enabled


def wrong(client, username):
    return client.post("/api/login", json={
        "username": username,
        "password": "wrong-password",
    })


def test_five_failures_then_too_many(client):
    sign_up(client, "casey")
    client.delete("/api/logout")

    for _ in range(5):
        assert wrong(client, "casey").status_code == 401

    blocked = wrong(client, "casey")
    assert blocked.status_code == 429
    assert blocked.get_json()["error"] == "Too many login attempts. Try again in a minute."


def test_a_successful_login_clears_failures(client):
    sign_up(client, "casey")
    client.delete("/api/logout")

    for _ in range(4):
        assert wrong(client, "casey").status_code == 401

    good = client.post("/api/login", json={
        "username": "casey",
        "password": PASSWORD,
    })
    assert good.status_code == 200
    client.delete("/api/logout")

    for _ in range(5):
        assert wrong(client, "casey").status_code == 401


def test_another_username_is_not_limited(client):
    sign_up(client, "casey")
    sign_up(client, "jordan")
    client.delete("/api/logout")

    for _ in range(5):
        assert wrong(client, "Casey").status_code == 401
    assert wrong(client, "casey").status_code == 429

    other = wrong(client, "jordan")
    assert other.status_code == 401


def test_login_and_signup_drop_old_session_keys(client):
    with client.session_transaction() as sess:
        sess["user_id"] = 999
        sess["extra"] = "stale"

    user = sign_up(client, "casey")
    with client.session_transaction() as sess:
        assert "extra" not in sess
        assert sess["user_id"] == user["id"]

    client.delete("/api/logout")
    with client.session_transaction() as sess:
        sess["user_id"] = 999
        sess["extra"] = "stale"

    client.post("/api/login", json={"username": "casey", "password": PASSWORD})
    with client.session_transaction() as sess:
        assert "extra" not in sess
        assert sess["user_id"] == user["id"]


def test_session_cookie_flags(client):
    assert app.config["SESSION_COOKIE_SAMESITE"] == "Lax"
    assert app.config["SESSION_COOKIE_HTTPONLY"] is True
    assert app.config["SESSION_COOKIE_SECURE"] is (not debug_enabled())

    sign_up(client, "casey")
    client.delete("/api/logout")
    response = client.post("/api/login", json={
        "username": "casey",
        "password": PASSWORD,
    })
    cookie = response.headers["Set-Cookie"]
    assert "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie
    if debug_enabled():
        assert "Secure" not in cookie
    else:
        assert "Secure" in cookie
