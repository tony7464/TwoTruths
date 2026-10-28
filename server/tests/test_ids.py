"""Out-of-range ids are 404 in the URL and 400 in a JSON body, never a 500."""

from test_rules import sign_up

HUGE = 10**30


def assert_error(response, status):
    body = response.get_json()
    assert response.status_code == status
    assert isinstance(body, dict)
    assert "error" in body


def test_thousands_of_digits_are_not_found(client):
    digits = "1" * 5000
    for method in ("get", "post", "patch", "delete"):
        for path in (f"/api/statements/{digits}", f"/api/{digits}"):
            response = getattr(client, method)(path)
            body = response.get_json()
            assert response.status_code == 404
            assert isinstance(body, dict)
            assert "error" in body


def test_huge_url_id_is_not_found(client):
    sign_up(client, "casey")
    fetched = client.get(f"/api/statements/{HUGE}")
    patched = client.patch(f"/api/statements/{HUGE}", json={"content": "Nope."})
    deleted = client.delete(f"/api/statements/{HUGE}")
    assert_error(fetched, 404)
    assert_error(patched, 404)
    assert_error(deleted, 404)


def test_zero_and_negative_url_ids_are_not_found(client):
    sign_up(client, "casey")
    for statement_id in (0, -1):
        patched = client.patch(f"/api/statements/{statement_id}", json={"content": "Nope."})
        deleted = client.delete(f"/api/statements/{statement_id}")
        assert_error(patched, 404)
        assert_error(deleted, 404)


def test_unicode_digits_are_not_a_server_error(client):
    for path in ("/api/²", "/api/statements/²", "/api/statements/١٢٣"):
        response = client.get(path)
        assert response.status_code in (404, 405)
        body = response.get_json()
        assert isinstance(body, dict)
        assert "error" in body


def test_bad_body_ids_are_rejected(client):
    sign_up(client, "casey")
    bad_ids = [HUGE, 0, -3, True, False, 1.5, "12"]
    for value in bad_ids:
        guess = client.post("/api/guesses", json={
            "profile_user_id": value,
            "statement_id": 1,
        })
        other_guess = client.post("/api/guesses", json={
            "profile_user_id": 1,
            "statement_id": value,
        })
        message = client.post("/api/messages", json={
            "recipient_id": value,
            "body": "hi",
        })
        assert_error(guess, 400)
        assert_error(other_guess, 400)
        assert_error(message, 400)
