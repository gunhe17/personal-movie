"""merge heads after feature_feed_9 merge

Revision ID: a3e84928a775
Revises: 848df83bf8b9, efc3541b94a1
Create Date: 2026-03-18 13:47:05.109177

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3e84928a775'
down_revision: Union[str, Sequence[str], None] = ('848df83bf8b9', 'efc3541b94a1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
