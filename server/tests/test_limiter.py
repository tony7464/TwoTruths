"""Login and signup limits, including a clock we can move by hand."""

from config import app, install_proxy_fix
from limiter import LoginLimiter, MAX_KEYS
from test_rules import sign_up


def fake_clock(start=0.0):
    box = {"now": start}

    def clock():
        return box["now"]

    return box, clock


def test_failures_expire_after_the_window():
    box, clock = fake_clock()
    limiter = LoginLimiter(5, clock=clock)
    for _ in range(5):
        limiter.record_failure("casey|1")
    assert limiter.is_blocked("casey|1")
    box["now"] = 59
    assert limiter.is_blocked("casey|1")
    assert limiter.retry_after("casey|1") == 1
    box["now"] = 60
    assert not limiter.is_blocked("casey|1")


def test_clear_forgets_failures():
    _box, clock = fake_clock()
    limiter = LoginLimiter(5, clock=clock)
    for _ in range(5):
        limiter.record_failure("casey|1")
        limiter.record_failure("other|1")
    limiter.clear("casey|1")
    assert not limiter.is_blocked("casey|1")
    assert limiter.is_blocked("other|1")
    assert limiter.key_count() == 1


def test_expired_keys_are_pruned():
    box, clock = fake_clock()
    limiter = LoginLimiter(5, clock=clock)
    for i in range(100):
        limiter.record_failure(f"old{i}")
    box["now"] = 120
    limiter.record_failure("fresh")
    assert limiter.key_count() == 1
    assert not limiter.is_blocked("old0")


def test_key_cap_drops_the_oldest():
    _box, clock = fake_clock(10)
    limiter = LoginLimiter(1, clock=clock)
    for i in range(MAX_KEYS):
        limiter.record_failure(f"k{i:05d}")
    assert limiter.key_count() == MAX_KEYS
    assert limiter.is_blocked("k00000")
    limiter.record_failure("newest")
    assert limiter.key_count() == MAX_KEYS
    assert not limiter.is_blocked("k00000")
    assert limiter.is_blocked("k00001")
    assert limiter.is_blocked("newest")


def test_cap_stays_exact_as_more_keys_arrive():
    _box, clock = fake_clock(10)
    limiter = LoginLimiter(1, clock=clock)
    extra = 25
    for i in range(MAX_KEYS + extra):
        limiter.record_failure(f"k{i:05d}")
        assert limiter.key_count() == min(i + 1, MAX_KEYS)
    assert limiter.key_count() == MAX_KEYS
    for i in range(extra):
        assert not limiter.is_blocked(f"k{i:05d}")
    assert limiter.is_blocked(f"k{extra:05d}")
    assert limiter.is_blocked(f"k{MAX_KEYS + extra - 1:05d}")


def test_pruning_expires_old_keys_and_keeps_a_fresh_one():
    box, clock = fake_clock()
    limiter = LoginLimiter(2, clock=clock)
    limiter.record_failure("old")
    limiter.record_failure("old")
    box["now"] = 20
    limiter.record_failure("fresh")
    box["now"] = 60
    assert not limiter.is_blocked("old")
    assert limiter.key_count() == 1
    assert not limiter.is_blocked("fresh")
    assert limiter.retry_after("fresh") == 20
    box["now"] = 80
    assert not limiter.is_blocked("fresh")
    assert limiter.key_count() == 0


def test_stale_stamps_inside_a_key_are_not_counted():
    box, clock = fake_clock()
    limiter = LoginLimiter(2, clock=clock)
    limiter.record_failure("casey")
    box["now"] = 30
    limiter.record_failure("casey")
    box["now"] = 60
    assert not limiter.is_blocked("casey")
    assert limiter.retry_after("casey") == 30


def test_retry_after_is_the_time_left_in_the_window():
    box, clock = fake_clock(1000)
    limiter = LoginLimiter(5, clock=clock)
    limiter.record_failure("casey|1")
    box["now"] = 1010
    for _ in range(4):
        limiter.record_failure("casey|1")
    assert limiter.retry_after("casey|1") == 50


def wrong(client, username):
    return client.post("/api/login", json={
        "username": username,
        "password": "wrong-password",
    })


def test_retry_after_header_is_present(client):
    sign_up(client, "casey")
    client.delete("/api/logout")
    for _ in range(5):
        assert wrong(client, "casey").status_code == 401
    blocked = wrong(client, "casey")
    assert blocked.status_code == 429
    assert "error" in blocked.get_json()
    wait = int(blocked.headers["Retry-After"])
    assert 1 <= wait <= 60


def test_one_ip_cannot_try_unlimited_usernames(client):
    for i in range(20):
        response = wrong(client, f"user{i}")
        assert response.status_code == 401
    blocked = wrong(client, "someoneelse")
    assert blocked.status_code == 429
    wait = int(blocked.headers["Retry-After"])
    assert 1 <= wait <= 60


def test_signup_attempts_are_limited(client):
    body = {"username": "casey", "password": "short"}
    for _ in range(10):
        response = client.post("/api/signup", json=body)
        assert response.status_code == 400
    blocked = client.post("/api/signup", json=body)
    assert blocked.status_code == 429
    assert "error" in blocked.get_json()
    wait = int(blocked.headers["Retry-After"])
    assert 1 <= wait <= 60


def test_trust_proxy_reads_x_forwarded_for(client, monkeypatch):
    sign_up(client, "casey")
    client.delete("/api/logout")
    monkeypatch.setenv("TRUST_PROXY", "1")
    original = app.wsgi_app
    install_proxy_fix(app)
    try:
        def attempt(ip):
            return client.post("/api/login", json={
                "username": "casey",
                "password": "wrong-password",
            }, headers={"X-Forwarded-For": ip})

        for _ in range(5):
            assert attempt("203.0.113.8").status_code == 401
        blocked = attempt("203.0.113.8")
        assert blocked.status_code == 429
        wait = int(blocked.headers["Retry-After"])
        assert 1 <= wait <= 60
        assert attempt("203.0.113.9").status_code == 401
    finally:
        app.wsgi_app = original
