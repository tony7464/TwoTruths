"""Text, password, and id checks shared by the routes."""

import re

USERNAME_PATTERN = re.compile(r"[A-Za-z0-9_]{3,20}")
MIN_PASSWORD = 6
MAX_BIO = 160
MAX_STATEMENT = 200
MAX_MESSAGE = 500


def is_valid_text(value):
    # A lone surrogate is legal JSON and a legal Python str, but it cannot be
    # encoded, stored, or hashed. That used to surface as a 500.
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        return False
    return True


def clean_text(value, limit):
    if not isinstance(value, str) or not is_valid_text(value):
        return None, "This field needs text."
    text = value.strip()
    if not text:
        return None, "This field needs text."
    if len(text) > limit:
        return None, f"Keep it under {limit} characters."
    return text, None


def clean_bio(value):
    # An empty bio is allowed and clears the field. Other text uses clean_text.
    if not isinstance(value, str) or not is_valid_text(value):
        return None, "Bio must be text."
    text = value.strip()
    if not text:
        return "", None
    return clean_text(text, MAX_BIO)


def password_error(password):
    # bcrypt raises above 72 bytes. That would be a 500, so reject it here.
    if not isinstance(password, str) or not is_valid_text(password):
        return "Password must be text."
    if len(password.encode("utf-8")) > 72:
        return "Password must be at most 72 bytes."
    return None


def parse_int(value):
    # Ids are JSON integers. Bool is a subclass of int, and a float would truncate.
    # Zero, negatives, and anything that does not fit in a signed 64-bit int are rejected.
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    if value <= 0 or value >= 2**63:
        return None
    return value
