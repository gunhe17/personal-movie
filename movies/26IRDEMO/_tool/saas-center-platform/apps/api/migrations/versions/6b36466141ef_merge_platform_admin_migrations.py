"""merge platform_admin migrations

Revision ID: 6b36466141ef
Revises: 53b57bc70759, a1b2c3d4e5f6
Create Date: 2026-03-11 15:33:58.868613

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6b36466141ef'
down_revision: Union[str, Sequence[str], None] = ('53b57bc70759', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
