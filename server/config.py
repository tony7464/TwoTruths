"""Flask app, database, and password hashing. Shared by app.py and the migrations."""

import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_marshmallow import Marshmallow
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SERVER_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = SERVER_DIR / "instance"
INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_DATABASE = (INSTANCE_DIR / "app.db").resolve()
DEFAULT_CLIENT_DIST = SERVER_DIR.parent / "client" / "dist"
DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def default_database_uri():
    # Absolute path, so seed, migrations, and flask run share one file
    # no matter which folder the command was started from.
    return "sqlite:///" + DEFAULT_DATABASE.as_posix()


def normalize_database_uri(uri):
    # Render and Heroku still hand out the old postgres:// scheme.
    # Some hosts use postgres+psycopg2:// for the same driver.
    # Scheme match is case-insensitive. The rest of the URI, including
    # the password and path, keeps its case. Other schemes are unchanged.
    stripped = uri.strip()
    lowered = stripped.lower()
    if lowered.startswith("postgres+psycopg2://"):
        return "postgresql+psycopg2://" + stripped[len("postgres+psycopg2://"):]
    if lowered.startswith("postgres://"):
        return "postgresql://" + stripped[len("postgres://"):]
    return stripped


def database_uri():
    raw = os.environ.get("DATABASE_URI") or os.environ.get("DATABASE_URL") or default_database_uri()
    return normalize_database_uri(raw)


def cors_origins():
    raw = os.environ.get("CORS_ORIGINS")
    if not raw or not raw.strip():
        return list(DEFAULT_CORS_ORIGINS)
    origins = []
    for item in raw.split(","):
        origin = item.strip().rstrip("/")
        if origin:
            origins.append(origin)
    return origins or list(DEFAULT_CORS_ORIGINS)


def client_dist_path():
    raw = os.environ.get("CLIENT_DIST")
    if raw:
        return raw
    return str(DEFAULT_CLIENT_DIST)


def debug_enabled():
    # Same values Flask treats as on: 1, true, yes. Unset or 0 is off.
    flag = os.environ.get("FLASK_DEBUG")
    if not flag:
        return False
    return flag.lower() not in {"0", "false", "no"}


def require_secret_key():
    key = os.environ.get("SECRET_KEY")
    if key:
        return key
    # Local `flask run` and npm start turn FLASK_DEBUG on. A public server must not.
    if debug_enabled():
        return "dev-only-change-me"
    raise RuntimeError(
        "SECRET_KEY is not set. Run npm run setup, which creates a key in .env. "
        "To set it yourself, copy .env.example to .env and put a long random SECRET_KEY there."
    )


def trust_proxy_enabled():
    return os.environ.get("TRUST_PROXY") == "1"


def install_proxy_fix(flask_app):
    # One proxy hop. Off unless TRUST_PROXY=1, so a laptop keeps the socket address.
    if not trust_proxy_enabled():
        return
    if isinstance(flask_app.wsgi_app, ProxyFix):
        return
    flask_app.wsgi_app = ProxyFix(flask_app.wsgi_app, x_for=1, x_proto=1, x_host=1)


# Names that Flask-Migrate can read. Flatiron lessons use this same map.
metadata = MetaData(naming_convention={
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
})


app = Flask(__name__)
# /api//users is a JSON 404. Merging the slashes used to answer with an HTML redirect.
app.url_map.merge_slashes = False
app.config["SQLALCHEMY_DATABASE_URI"] = database_uri()
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = require_secret_key()
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True
# Local npm start sets FLASK_DEBUG, so the cookie still works over http://127.0.0.1.
app.config["SESSION_COOKIE_SECURE"] = not debug_enabled()
app.config["CLIENT_DIST"] = client_dist_path()
# A signup or a message is small. Anything larger is a JSON 413.
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024
app.json.compact = False

db = SQLAlchemy(metadata=metadata)
db.init_app(app)
migrate = Migrate(app, db)
bcrypt = Bcrypt(app)
ma = Marshmallow(app)

# The Vite dev server proxies /api, so cookies stay on localhost.
# CORS is here for any request that skips the proxy.
CORS(app, supports_credentials=True, origins=cors_origins())
install_proxy_fix(app)
