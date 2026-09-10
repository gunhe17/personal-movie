"""merge assistant and schedule change request heads

Revision ID: 5721e395a24a
Revises: 7b6bd32f1b12, a7c31d94e5b2
Create Date: 2026-07-28 11:27:29.984856

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5721e395a24a'
down_revision: Union[str, Sequence[str], None] = ('7b6bd32f1b12', 'a7c31d94e5b2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
