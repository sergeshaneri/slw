"""add diary step_id

Revision ID: a1b2c3d4e5f6
Revises: 0d8537de0d00
Create Date: 2026-04-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '0d8537de0d00'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('diary_entries',
        sa.Column('step_id', sa.Text(), sa.ForeignKey('script_steps.id'), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('diary_entries', 'step_id')
