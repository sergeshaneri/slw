"""add display_name to web_users

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = "d5e6f7a8b9c0"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "web_users",
        sa.Column("display_name", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("web_users", "display_name")
