"""merge main-bridge and branch heads

Revision ID: c5768f75e312
Revises: 7babcaa0410b, e83b5c2f47a1
Create Date: 2026-07-22 17:15:26.914241

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5768f75e312'
down_revision: Union[str, Sequence[str], None] = ('7babcaa0410b', 'e83b5c2f47a1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
