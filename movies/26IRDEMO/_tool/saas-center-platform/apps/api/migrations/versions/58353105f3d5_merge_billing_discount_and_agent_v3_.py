"""merge billing discount and agent v3 heads

Revision ID: 58353105f3d5
Revises: 47d8763dc43a, a2590d773987
Create Date: 2026-04-23 14:52:40.821170

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '58353105f3d5'
down_revision: Union[str, Sequence[str], None] = ('47d8763dc43a', 'a2590d773987')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
