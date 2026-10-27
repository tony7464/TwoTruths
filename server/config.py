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

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SERVER_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = SERVER_DIR / "instance"
INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_DATABASE = (INSTANCE_DIR / "app.db").resolve()


def default_database_uri():
    # Absolute path, so seed, migrations, and flask run share one file
    # no matter which folder the command was started from.
    return "sqlite:///" + DEFAULT_DATABASE.as_posix()


# Names that Flask-Migrate can read. Flatiron lessons use this same map.
metadata = MetaData(naming_convention={
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
})

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URI") or default_database_uri()
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY") or "dev-only-change-me"
app.json.compact = False

db = SQLAlchemy(metadata=metadata)
db.init_app(app)
migrate = Migrate(app, db)
bcrypt = Bcrypt(app)
ma = Marshmallow(app)

# The Vite dev server proxies /api, so cookies stay on localhost.
# CORS is here for any request that skips the proxy.
CORS(app, supports_credentials=True, origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
])
