"""widen event_atomics act column to 30 chars

Revision ID: 767c5970e78a
Revises: 23c7b2c9e958
Create Date: 2026-08-03 14:20:58.070178

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '767c5970e78a'
down_revision: Union[str, Sequence[str], None] = '23c7b2c9e958'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('event_atomics', 'act',
               existing_type=sa.VARCHAR(length=20),
               type_=sa.String(length=30),
               existing_nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('event_atomics', 'act',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=20),
               existing_nullable=False)
