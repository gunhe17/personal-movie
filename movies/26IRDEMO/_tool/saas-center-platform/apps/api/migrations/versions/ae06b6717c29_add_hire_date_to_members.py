"""add hire_date to members

Revision ID: ae06b6717c29
Revises: 49e748b2712a
Create Date: 2026-02-25 14:44:48.211425

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ae06b6717c29'
down_revision: Union[str, Sequence[str], None] = '49e748b2712a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('members', sa.Column('hire_date', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('members', 'hire_date')
