"""Usernames compare case-insensitively, and the migration refuses mixed-case duplicates."""

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

from app import app
from config import db
from test_rules import PASSWORD, sign_up

SERVER = Path(__file__).resolve().parents[1]


def test_signup_rejects_the_same_name_in_another_case(client):
    sign_up(client, "Alice")
    response = client.post("/api/signup", json={
        "username": "ALICE",
        "password": PASSWORD,
    })
    assert response.status_code == 409
    assert "taken" in response.get_json()["error"].lower()
    # The typed case is what we keep.
    session = client.get("/api/check_session").get_json()
    assert session["username"] == "Alice"


def test_login_uses_the_stored_case(client):
    sign_up(client, "alex")
    client.delete("/api/logout")
    response = client.post("/api/login", json={
        "username": "ALEX",
        "password": PASSWORD,
    })
    assert response.status_code == 200
    assert response.get_json()["username"] == "alex"
    assert client.get("/api/check_session").get_json()["username"] == "alex"


def test_users_table_has_a_case_insensitive_index(client):
    with app.app_context():
        row = db.session.execute(db.text(
            "SELECT sql FROM sqlite_master WHERE name = 'uq_users_username_lower'"
        )).first()
    assert row is not None
    assert row[0] is not None
    assert "lower" in row[0].lower()


def flask_env(db_path):
    env = os.environ.copy()
    env["SECRET_KEY"] = "test-only-secret"
    env["FLASK_DEBUG"] = "0"
    env["FLASK_APP"] = "app.py"
    env["DATABASE_URI"] = "sqlite:///" + Path(db_path).resolve().as_posix()
    env.pop("DATABASE_URL", None)
    return env


def run_flask(args, env):
    return subprocess.run(
        [sys.executable, "-m", "flask", *args],
        cwd=SERVER,
        env=env,
        capture_output=True,
        text=True,
    )


def test_upgrade_from_an_empty_database(tmp_path):
    db_path = tmp_path / "empty.db"
    env = flask_env(db_path)
    upgraded = run_flask(["db", "upgrade"], env)
    assert upgraded.returncode == 0, upgraded.stderr

    connection = sqlite3.connect(db_path)
    index_sql = connection.execute(
        "SELECT sql FROM sqlite_master WHERE name = 'uq_users_username_lower'"
    ).fetchone()
    connection.close()
    assert index_sql is not None
    assert "lower" in index_sql[0].lower()

    seeded = subprocess.run(
        [sys.executable, "seed.py"],
        cwd=SERVER,
        env=env,
        capture_output=True,
        text=True,
    )
    assert seeded.returncode == 0, seeded.stderr
    again = subprocess.run(
        [sys.executable, "seed.py", "--if-empty"],
        cwd=SERVER,
        env=env,
        capture_output=True,
        text=True,
    )
    assert again.returncode == 0, again.stderr
    assert "already there" in again.stdout

    connection = sqlite3.connect(db_path)
    count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    connection.close()
    assert count == 4


def test_upgrade_stops_when_names_differ_only_by_case(tmp_path):
    db_path = tmp_path / "dupes.db"
    env = flask_env(db_path)
    base = run_flask(["db", "upgrade", "86617fecaa7f"], env)
    assert base.returncode == 0, base.stderr

    connection = sqlite3.connect(db_path)
    connection.execute(
        "INSERT INTO users (username, _password_hash, bio, score) VALUES (?, ?, ?, ?)",
        ("Alice", "x", "", 0),
    )
    connection.execute(
        "INSERT INTO users (username, _password_hash, bio, score) VALUES (?, ?, ?, ?)",
        ("ALICE", "x", "", 0),
    )
    connection.commit()
    connection.close()

    failed = run_flask(["db", "upgrade"], env)
    output = failed.stdout + failed.stderr
    assert failed.returncode != 0
    assert "differ only by case" in output
    assert "Alice" in output
    assert "ALICE" in output

    connection = sqlite3.connect(db_path)
    index_sql = connection.execute(
        "SELECT sql FROM sqlite_master WHERE name = 'uq_users_username_lower'"
    ).fetchone()
    connection.close()
    assert index_sql is None
