"""Health check, static client files, database URL scheme, and JSON errors."""

from config import app, cors_origins, database_uri, db, normalize_database_uri
from test_rules import sign_up


def test_postgres_scheme_is_normalized():
    assert normalize_database_uri("postgres://user:pw@host:5432/db") == "postgresql://user:pw@host:5432/db"
    assert normalize_database_uri("postgres+psycopg2://user:pw@host:5432/db") == "postgresql+psycopg2://user:pw@host:5432/db"
    assert normalize_database_uri("postgresql://host/db") == "postgresql://host/db"
    assert normalize_database_uri("postgresql+psycopg2://host/db") == "postgresql+psycopg2://host/db"
    assert normalize_database_uri("sqlite:///tmp/app.db") == "sqlite:///tmp/app.db"
    assert normalize_database_uri("  Postgres://u:p@h/db ") == "postgresql://u:p@h/db"
    assert normalize_database_uri("POSTGRES+PSYCOPG2://user:Secret@Host/MyDB") == "postgresql+psycopg2://user:Secret@Host/MyDB"
    assert normalize_database_uri("  sqlite:///tmp/App.db  ") == "sqlite:///tmp/App.db"
    assert normalize_database_uri("MySQL://Host/DB") == "MySQL://Host/DB"


def test_cors_origins_strip_space_and_trailing_slash(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://a.com/, http://b.com")
    assert cors_origins() == ["http://a.com", "http://b.com"]

    monkeypatch.setenv("CORS_ORIGINS", " , http://a.com/ , ")
    assert cors_origins() == ["http://a.com"]

    monkeypatch.setenv("CORS_ORIGINS", " , ")
    assert cors_origins() == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_database_uri_reads_both_env_names(monkeypatch):
    monkeypatch.setenv("DATABASE_URI", "postgres://db.example/from-uri")
    monkeypatch.setenv("DATABASE_URL", "postgres://db.example/from-url")
    assert database_uri() == "postgresql://db.example/from-uri"

    monkeypatch.delenv("DATABASE_URI")
    assert database_uri() == "postgresql://db.example/from-url"


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json() == {"ok": True}


def test_built_client_is_served_and_api_stays_json(client, tmp_path):
    dist = tmp_path / "dist"
    assets = dist / "assets"
    assets.mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>Two Truths</title>")
    (assets / "app.js").write_text("console.log('ok')")
    (dist / "favicon.ico").write_bytes(b"ico")
    previous = app.config["CLIENT_DIST"]
    app.config["CLIENT_DIST"] = str(dist)
    try:
        home = client.get("/")
        assert home.status_code == 200
        assert b"Two Truths" in home.data

        deep = client.get("/play/alex")
        assert deep.status_code == 200
        assert b"Two Truths" in deep.data

        script = client.get("/assets/app.js")
        assert script.status_code == 200
        assert b"console.log" in script.data
        assert script.headers["Cache-Control"] == "public, max-age=31536000, immutable"

        icon = client.get("/favicon.ico")
        assert icon.status_code == 200
        assert icon.data == b"ico"

        assert home.headers["Cache-Control"] == "no-cache"
        assert deep.headers["Cache-Control"] == "no-cache"

        missing_asset = client.get("/assets/missing.js")
        assert missing_asset.status_code == 404
        assert "error" in missing_asset.get_json()
        assert b"Two Truths" not in missing_asset.data

        missing = client.get("/api/no-such-route")
        assert missing.status_code == 404
        assert "error" in missing.get_json()

        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.get_json() == {"ok": True}

        sign_up(client, "casey")
        method = client.delete("/api/statements/1")
        assert method.status_code == 405
        assert "error" in method.get_json()
    finally:
        app.config["CLIENT_DIST"] = previous


def test_missing_dist_leaves_pages_as_json_404(client, tmp_path):
    previous = app.config["CLIENT_DIST"]
    app.config["CLIENT_DIST"] = str(tmp_path / "no-dist")
    try:
        response = client.get("/")
        assert response.status_code == 404
        assert "error" in response.get_json()
        assert client.get("/api/health").get_json() == {"ok": True}
    finally:
        app.config["CLIENT_DIST"] = previous


def test_double_slash_api_path_is_json(client):
    response = client.get("/api//users")
    assert response.status_code == 404
    assert response.is_json
    body = response.get_json()
    assert isinstance(body, dict)
    assert "error" in body


def test_body_over_the_real_cap_is_rejected(client):
    sign_up(client, "casey")
    payload = '{"blob":"' + ("y" * (100 * 1024)) + '"}'
    assert len(payload.encode("utf-8")) > 64 * 1024
    signup = client.post("/api/signup", data=payload, content_type="application/json")
    message = client.post("/api/messages", data=payload, content_type="application/json")
    for response in (signup, message):
        assert response.status_code == 413
        assert "error" in response.get_json()
    still = client.patch("/api/profile", json={"bio": "Still here"})
    assert still.status_code == 200
    assert still.get_json()["bio"] == "Still here"


def test_large_body_is_json(client):
    previous = app.config.get("MAX_CONTENT_LENGTH")
    app.config["MAX_CONTENT_LENGTH"] = 32
    try:
        response = client.post(
            "/api/login",
            data="{" + ("x" * 80),
            content_type="application/json",
        )
    finally:
        app.config["MAX_CONTENT_LENGTH"] = previous
    assert response.status_code == 413
    assert "error" in response.get_json()


def test_internal_error_is_json_and_rolls_back(client, monkeypatch):
    previous = app.config.get("PROPAGATE_EXCEPTIONS")
    app.config["PROPAGATE_EXCEPTIONS"] = False
    rolled = {"n": 0}
    real_rollback = db.session.rollback

    def spy_rollback(*args, **kwargs):
        rolled["n"] += 1
        return real_rollback(*args, **kwargs)

    def boom(*args, **kwargs):
        raise RuntimeError("secret-token-should-not-leak")

    monkeypatch.setattr(db.session, "rollback", spy_rollback)
    monkeypatch.setattr(db.session, "commit", boom)
    try:
        response = client.post("/api/signup", json={
            "username": "casey",
            "password": "password123",
        })
    finally:
        app.config["PROPAGATE_EXCEPTIONS"] = previous
    assert response.status_code == 500
    assert "error" in response.get_json()
    assert "secret-token" not in response.get_data(as_text=True)
    assert rolled["n"] >= 1
