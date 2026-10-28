"""Each test gets its own SQLite file so the dev database is never touched."""

import os

import pytest
from sqlalchemy import create_engine

# config.py reads SECRET_KEY while it is imported and will not start without one
# unless FLASK_DEBUG is on. Set a test key before that import.
os.environ.setdefault("SECRET_KEY", "test-only-secret")

from app import app
from config import db
from limiter import reset_login_limiter


@pytest.fixture(autouse=True)
def clean_login_limiter():
    reset_login_limiter()
    yield
    reset_login_limiter()


@pytest.fixture
def client(tmp_path):
    # The app builds its dev engine on import. Point this process at a
    # throwaway file so pytest never writes to instance/app.db.
    uri = f"sqlite:///{tmp_path / 'test.db'}"
    engine = create_engine(uri)
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = uri

    with app.app_context():
        db.session.remove()
        engines = db._app_engines.setdefault(app, {})
        for old in list(engines.values()):
            old.dispose()
        engines.clear()
        engines[None] = engine
        db.create_all()

    with app.test_client() as test_client:
        yield test_client

    with app.app_context():
        db.session.remove()
        db.drop_all()
        engine.dispose()


@pytest.fixture
def other(client):
    """A second browser. Depends on client so the test database exists first."""
    return app.test_client()
