"""Setup writes a SECRET_KEY, and a missing key names npm run setup."""

import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def test_missing_secret_key_tells_you_to_run_setup(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("FLASK_DEBUG", raising=False)
    from config import require_secret_key

    with pytest.raises(RuntimeError) as caught:
        require_secret_key()

    message = str(caught.value)
    assert "npm run setup" in message
    assert ".env.example" in message


def run_ensure_env(env_file):
    script = 'const { ensureEnv } = require("./scripts/setup.js"); ensureEnv(process.argv[1]);'
    subprocess.run(["node", "-e", script, str(env_file)], cwd=ROOT, check=True)


def test_setup_appends_a_key_when_the_line_is_missing(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("DATABASE_URI=sqlite:///demo.db")
    run_ensure_env(env_file)
    text = env_file.read_text()
    assert text.startswith("DATABASE_URI=sqlite:///demo.db\n")
    assert re.search(r"^SECRET_KEY=[0-9a-f]{64}$", text, re.M)


def secret_lines(text):
    return [line for line in text.splitlines() if re.match(r"^\s*(?:export\s+)?SECRET_KEY\s*=", line)]


def test_setup_replaces_an_empty_key_in_place(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("SECRET_KEY=\nFOO=1\n")
    run_ensure_env(env_file)
    text = env_file.read_text()
    assert text.startswith("SECRET_KEY=")
    assert "\nFOO=1\n" in text
    assert re.search(r"^SECRET_KEY=[0-9a-f]{64}$", text, re.M)
    assert len(secret_lines(text)) == 1


def test_setup_replaces_only_the_last_empty_key(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("SECRET_KEY=already-set\nSECRET_KEY=\n")
    run_ensure_env(env_file)
    text = env_file.read_text()
    lines = secret_lines(text)
    assert lines[0] == "SECRET_KEY=already-set"
    assert re.fullmatch(r"SECRET_KEY=[0-9a-f]{64}", lines[1])
    assert len(lines) == 2


def test_setup_leaves_the_file_when_the_last_key_is_set(tmp_path):
    env_file = tmp_path / ".env"
    original = "SECRET_KEY=\nSECRET_KEY=already-set\n"
    env_file.write_text(original)
    run_ensure_env(env_file)
    assert env_file.read_text() == original
    assert len(secret_lines(env_file.read_text())) == 2


def test_setup_leaves_an_existing_key_alone(tmp_path):
    env_file = tmp_path / ".env"
    original = "SECRET_KEY=already-set\nDATABASE_URI=sqlite:///demo.db\n"
    env_file.write_text(original)
    run_ensure_env(env_file)
    assert env_file.read_text() == original


def test_setup_keeps_a_key_with_spaces_around_the_equals(tmp_path):
    env_file = tmp_path / ".env"
    original = "SECRET_KEY = already-set\nFOO=1\n"
    env_file.write_text(original)
    run_ensure_env(env_file)
    assert env_file.read_text() == original
    assert len(secret_lines(env_file.read_text())) == 1


def test_setup_keeps_an_exported_key(tmp_path):
    env_file = tmp_path / ".env"
    original = "export SECRET_KEY=already-set\n"
    env_file.write_text(original)
    run_ensure_env(env_file)
    assert env_file.read_text() == original


def test_setup_keeps_a_quoted_key(tmp_path):
    env_file = tmp_path / ".env"
    original = 'export SECRET_KEY = "already-set"\n'
    env_file.write_text(original)
    run_ensure_env(env_file)
    assert env_file.read_text() == original


def test_setup_replaces_a_double_quoted_empty_key(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text('FOO=1\nSECRET_KEY=""\nBAR=2\n')
    run_ensure_env(env_file)
    text = env_file.read_text()
    assert text.startswith("FOO=1\n")
    assert text.endswith("\nBAR=2\n")
    assert re.search(r"^SECRET_KEY=[0-9a-f]{64}$", text, re.M)
    assert len(secret_lines(text)) == 1


def test_setup_replaces_a_single_quoted_empty_key(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("SECRET_KEY=''\nFOO=1\n")
    run_ensure_env(env_file)
    text = env_file.read_text()
    assert re.search(r"^SECRET_KEY=[0-9a-f]{64}$", text, re.M)
    assert "\nFOO=1\n" in text
    assert len(secret_lines(text)) == 1


def test_setup_ignores_a_different_case_name(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("secret_key=not-the-setting\n")
    run_ensure_env(env_file)
    text = env_file.read_text()
    assert text.startswith("secret_key=not-the-setting\n")
    assert re.search(r"^SECRET_KEY=[0-9a-f]{64}$", text, re.M)
