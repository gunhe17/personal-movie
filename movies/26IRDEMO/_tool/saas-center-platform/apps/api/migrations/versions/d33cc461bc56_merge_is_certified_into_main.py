"""merge is_certified into main

Revision ID: d33cc461bc56
Revises: 96b9eca11d65, c8d2a1f4b6e3
Create Date: 2026-05-27 17:55:05.522160

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd33cc461bc56'
down_revision: Union[str, Sequence[str], None] = ('96b9eca11d65', 'c8d2a1f4b6e3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
