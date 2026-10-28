"""Bad JSON and wrong field types are 400, with an error key, never a 500."""

import io

import pytest
from flask import request

from app import app
from test_rules import sign_up

ROUTES = [
    ("post", "/api/signup", False),
    ("post", "/api/login", False),
    ("post", "/api/statements", True),
    ("patch", "/api/statements/1", True),
    ("post", "/api/guesses", True),
    ("post", "/api/messages", True),
]


def assert_error(response):
    body = response.get_json()
    assert response.status_code == 400
    assert isinstance(body, dict)
    assert "error" in body


def send(client, method, path, **kwargs):
    return getattr(client, method)(path, **kwargs)


@pytest.mark.parametrize("method,path,needs_login", ROUTES)
@pytest.mark.parametrize("body", ["[]", "", "{"])
def test_list_invalid_and_empty_bodies_are_rejected(client, method, path, needs_login, body):
    if needs_login:
        sign_up(client, "casey")
    response = send(client, method, path, data=body, content_type="application/json")
    assert_error(response)


def test_signup_rejects_a_password_over_72_bytes(client):
    too_long = client.post("/api/signup", json={
        "username": "casey",
        "password": "a" * 73,
    })
    assert_error(too_long)

    # 19 emoji are 19 characters and 76 UTF-8 bytes, past bcrypt's byte limit.
    emoji = client.post("/api/signup", json={
        "username": "casey",
        "password": "🙂" * 19,
    })
    assert_error(emoji)

    fits = client.post("/api/signup", json={
        "username": "casey",
        "password": "a" * 72,
    })
    assert fits.status_code == 201


def test_signup_rejects_a_non_string_username(client):
    response = client.post("/api/signup", json={
        "username": 12,
        "password": "password123",
    })
    assert_error(response)


def test_signup_rejects_a_non_string_password(client):
    response = client.post("/api/signup", json={
        "username": "casey",
        "password": 123456,
    })
    assert_error(response)


def test_login_rejects_a_non_string_username(client):
    response = client.post("/api/login", json={
        "username": 12,
        "password": "password123",
    })
    assert_error(response)


def test_login_rejects_a_non_string_password(client):
    response = client.post("/api/login", json={
        "username": "casey",
        "password": 123456,
    })
    assert_error(response)


def test_login_rejects_a_password_over_72_bytes(client):
    response = client.post("/api/login", json={
        "username": "casey",
        "password": "a" * 73,
    })
    assert_error(response)


def test_lone_surrogates_are_rejected(client):
    sign_up(client, "casey")
    statements = [
        {"content": "I like rain.", "is_lie": False},
        {"content": "I own a boat.", "is_lie": True},
        {"content": "I drink tea.", "is_lie": False},
    ]
    for text in ("\ud800", "a\udfffb"):
        bad_statements = [dict(statements[0], content=text), statements[1], statements[2]]
        responses = [
            client.post("/api/signup", json={"username": text, "password": "password123"}),
            client.post("/api/signup", json={"username": "other", "password": text}),
            client.post("/api/signup", json={
                "username": "other",
                "password": "password123",
                "bio": text,
            }),
            client.post("/api/login", json={"username": text, "password": "password123"}),
            client.post("/api/login", json={"username": "casey", "password": text}),
            client.patch("/api/profile", json={"bio": text}),
            client.post("/api/statements", json={"statements": bad_statements}),
            client.post("/api/messages", json={"recipient_id": 1, "body": text}),
            client.delete("/api/account", json={"password": text}),
        ]
        for response in responses:
            assert_error(response)

    session = client.get("/api/check_session").get_json()
    assert session["username"] == "casey"
    assert session["bio"] == "Hello"
    assert client.get("/api/statements").get_json() == []
    missed = client.post("/api/login", json={"username": "other", "password": "password123"})
    assert missed.status_code == 401


def _post_raw(client, method, path, body):
    return send(client, method, path, data=body, content_type="application/json")


def _with_room_for(body):
    previous = app.config["MAX_CONTENT_LENGTH"]
    size = len(body.encode("utf-8"))
    if size > previous:
        app.config["MAX_CONTENT_LENGTH"] = size
    return previous


def test_deeply_nested_json_is_rejected(client):
    sign_up(client, "casey")
    bodies = (
        "[" * 20000,
        '{"a":' * 20000 + "null" + "}" * 20000,
    )
    for body in bodies:
        previous = _with_room_for(body)
        try:
            login = _post_raw(client, "post", "/api/login", body)
            profile = _post_raw(client, "patch", "/api/profile", body)
        finally:
            app.config["MAX_CONTENT_LENGTH"] = previous
        for response in (login, profile):
            assert response.status_code == 400
            payload = response.get_json()
            assert isinstance(payload, dict)
            assert "error" in payload


def test_extremely_nested_json_on_login_is_rejected(client):
    body = "[" * 100000
    previous = _with_room_for(body)
    try:
        response = _post_raw(client, "post", "/api/login", body)
    finally:
        app.config["MAX_CONTENT_LENGTH"] = previous
    assert response.status_code == 400
    assert isinstance(response.get_json(), dict)
    assert "error" in response.get_json()


def test_chunked_body_over_the_cap_is_rejected(client):
    payload = b'{"blob":"' + (b"y" * (100 * 1024)) + b'"}'
    assert len(payload) > 64 * 1024
    seen = {}

    def spy():
        seen["content_length"] = request.content_length
        seen["content_length_header"] = request.environ.get("CONTENT_LENGTH")
        seen["terminated"] = request.environ.get("wsgi.input_terminated")
        seen["transfer"] = request.environ.get("HTTP_TRANSFER_ENCODING")

    hooks = app.before_request_funcs.setdefault(None, [])
    hooks.append(spy)
    try:
        response = client.post(
            "/api/signup",
            data=io.BytesIO(payload),
            content_type="application/json",
            environ_overrides={
                "CONTENT_LENGTH": None,
                "HTTP_TRANSFER_ENCODING": "chunked",
                "wsgi.input_terminated": True,
            },
        )
    finally:
        hooks.remove(spy)
    assert seen["content_length"] is None
    assert seen["content_length_header"] is None
    assert seen["terminated"] is True
    assert seen["transfer"] == "chunked"
    assert response.status_code == 413
    assert response.get_json()["error"] == "Request is too large."


def test_wrong_typed_fields_are_rejected(client):
    sign_up(client, "casey")
    cases = [
        ("post", "/api/signup", {"username": "other", "password": "password123", "bio": 5}),
        ("post", "/api/statements", {"statements": "nope"}),
        ("post", "/api/statements", {"statements": [
            {"content": 1, "is_lie": False},
            {"content": "I like rain.", "is_lie": True},
            {"content": "I drink tea.", "is_lie": False},
        ]}),
        ("post", "/api/statements", {"statements": ["one", "two", "three"]}),
        ("patch", "/api/statements/1", {"content": 1}),
        ("patch", "/api/statements/1", {"is_lie": "yes"}),
        ("post", "/api/guesses", {"profile_user_id": "alex", "statement_id": "nope"}),
        ("post", "/api/guesses", {"profile_user_id": ["1"], "statement_id": 1}),
        ("post", "/api/messages", {"recipient_id": "someone", "body": "hi"}),
        ("post", "/api/messages", {"recipient_id": 1, "body": 5}),
    ]
    for method, path, payload in cases:
        assert_error(send(client, method, path, json=payload))
