"""add web auth tables

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "b3c4d5e6f7a8"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "web_users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.Text(), unique=True, nullable=True),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("telegram_id", sa.BigInteger(), unique=True, nullable=True),
        sa.Column("telegram_username", sa.Text(), nullable=True),
        sa.Column("telegram_first_name", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )

    op.create_table(
        "web_state",
        sa.Column("web_user_id", sa.Integer(), sa.ForeignKey("web_users.id"), primary_key=True),
        sa.Column("journey", JSONB(), nullable=True),
        sa.Column("history", JSONB(), nullable=True),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )

    op.create_table(
        "web_scores",
        sa.Column("web_user_id", sa.Integer(), sa.ForeignKey("web_users.id"), primary_key=True),
        sa.Column("aspect", sa.Text(), primary_key=True),
        sa.Column("value", sa.Numeric(3, 1), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )

    op.create_table(
        "web_diary_entries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("web_user_id", sa.Integer(), sa.ForeignKey("web_users.id"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("aspect", sa.Text(), nullable=True),
        sa.Column("source", sa.Text(), nullable=False, server_default="web"),
        sa.Column("extra", JSONB(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("web_diary_entries")
    op.drop_table("web_scores")
    op.drop_table("web_state")
    op.drop_table("web_users")
