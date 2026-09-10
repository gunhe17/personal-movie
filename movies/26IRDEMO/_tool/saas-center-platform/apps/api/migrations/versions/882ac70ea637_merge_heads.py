"""merge heads

Revision ID: 882ac70ea637
Revises: 33f28dbfcfae, c8b4d1f02a3e
Create Date: 2026-04-10 10:52:59.938960

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '882ac70ea637'
down_revision: Union[str, Sequence[str], None] = ('33f28dbfcfae', 'c8b4d1f02a3e')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
