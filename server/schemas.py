"""Shapes the API returns. Browse responses leave is_lie off so the game still works."""

from marshmallow import fields

from config import ma
from models import Message, Statement, User


class PublicStatementSchema(ma.SQLAlchemySchema):
    """Browse view. is_lie is left off on purpose so the game still works."""

    class Meta:
        model = Statement

    id = ma.auto_field()
    content = ma.auto_field()


class OwnerStatementSchema(PublicStatementSchema):
    is_lie = ma.auto_field()


class PublicUserSchema(ma.SQLAlchemySchema):
    class Meta:
        model = User

    id = ma.auto_field()
    username = ma.auto_field()
    bio = ma.auto_field()
    score = ma.auto_field()
    fooled_count = fields.Function(lambda user: user.fooled_count)
    statements = fields.Nested(PublicStatementSchema, many=True)


class OwnerUserSchema(PublicUserSchema):
    statements_locked = fields.Function(lambda user: user.statements_locked)
    statements = fields.Nested(OwnerStatementSchema, many=True)


class MessageSchema(ma.SQLAlchemySchema):
    class Meta:
        model = Message

    id = ma.auto_field()
    body = ma.auto_field()
    created_at = ma.auto_field()
    sender_id = ma.auto_field()
    recipient_id = ma.auto_field()
    sender_username = fields.Function(lambda message: message.sender.username)
    recipient_username = fields.Function(lambda message: message.recipient.username)


public_user_schema = PublicUserSchema()
owner_user_schema = OwnerUserSchema()
owner_statement_schema = OwnerStatementSchema()
owner_statements_schema = OwnerStatementSchema(many=True)
messages_schema = MessageSchema(many=True)
