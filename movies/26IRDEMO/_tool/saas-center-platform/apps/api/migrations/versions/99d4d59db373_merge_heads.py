"""merge_heads

Revision ID: 99d4d59db373
Revises: 3c0a48bd95a0, e5f6a7b8c9d0
Create Date: 2026-03-31 10:08:45.255824

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '99d4d59db373'
down_revision: Union[str, Sequence[str], None] = ('3c0a48bd95a0', 'e5f6a7b8c9d0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
