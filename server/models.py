"""Database tables: users, statements, guesses, and messages."""

from config import bcrypt, db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String, unique=True, nullable=False)
    _password_hash = db.Column(db.String, nullable=False)
    bio = db.Column(db.String, nullable=False, default="")
    score = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    statements = db.relationship(
        "Statement",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="Statement.id",
    )

    @property
    def password(self):
        raise AttributeError("Password is write-only.")

    @password.setter
    def password(self, plain_text):
        self._password_hash = bcrypt.generate_password_hash(plain_text).decode("utf-8")

    def authenticate(self, plain_text):
        return bcrypt.check_password_hash(self._password_hash, plain_text)

    @property
    def fooled_count(self):
        # Wrong guesses against this profile. Not stored, so it cannot drift.
        return Guess.query.filter_by(profile_user_id=self.id, is_correct=False).count()

    @property
    def statements_locked(self):
        # One guess freezes the set. Editing the lie would rewrite old results.
        return Guess.query.filter_by(profile_user_id=self.id).first() is not None

    def __repr__(self):
        return f"<User {self.username}>"


class Statement(db.Model):
    __tablename__ = "statements"

    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.String, nullable=False)
    is_lie = db.Column(db.Boolean, nullable=False, default=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    user = db.relationship("User", back_populates="statements")

    def __repr__(self):
        return f"<Statement {self.id} user={self.user_id} lie={self.is_lie}>"


class Guess(db.Model):
    __tablename__ = "guesses"

    id = db.Column(db.Integer, primary_key=True)
    guesser_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    profile_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    statement_id = db.Column(db.Integer, db.ForeignKey("statements.id"), nullable=False)
    is_correct = db.Column(db.Boolean, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    __table_args__ = (
        db.UniqueConstraint("guesser_id", "profile_user_id", name="one_guess_per_profile"),
    )

    def __repr__(self):
        return f"<Guess {self.guesser_id} -> {self.profile_user_id} correct={self.is_correct}>"


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    body = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    sender = db.relationship("User", foreign_keys=[sender_id])
    recipient = db.relationship("User", foreign_keys=[recipient_id])

    def __repr__(self):
        return f"<Message {self.sender_id} -> {self.recipient_id}>"
