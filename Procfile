# Migrate, then serve. The host sets PORT.
web: cd server && flask db upgrade && gunicorn app:app --bind 0.0.0.0:$PORT
