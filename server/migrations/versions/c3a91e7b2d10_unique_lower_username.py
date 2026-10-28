"""unique lower username

Revision ID: c3a91e7b2d10
Revises: 86617fecaa7f
Create Date: 2026-10-26 21:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "c3a91e7b2d10"
down_revision = "86617fecaa7f"
branch_labels = None
depends_on = None


def upgrade():
    # Stop instead of merging rows when Alice and ALICE already both exist.
    connection = op.get_bind()
    rows = connection.execute(sa.text(
        """
        SELECT username FROM users
        WHERE lower(username) IN (
            SELECT lower(username) FROM users
            GROUP BY lower(username)
            HAVING COUNT(*) > 1
        )
        """
    )).fetchall()
    if rows:
        names = ", ".join(sorted(row[0] for row in rows))
        raise RuntimeError(
            "Cannot make usernames case-insensitive. These names differ only by case: "
            f"{names}. Rename them so each lower(username) is unique, then run the migration again."
        )
    op.create_index(
        "uq_users_username_lower",
        "users",
        [sa.text("lower(username)")],
        unique=True,
    )


def downgrade():
    op.drop_index("uq_users_username_lower", table_name="users")
