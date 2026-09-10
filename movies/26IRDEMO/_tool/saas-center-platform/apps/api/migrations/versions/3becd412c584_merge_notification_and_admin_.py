"""merge notification and admin_invitations heads

Revision ID: 3becd412c584
Revises: 220c784ce409, c0ed455c18e5
Create Date: 2026-03-10 15:05:05.052303

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3becd412c584'
down_revision: Union[str, Sequence[str], None] = ('220c784ce409', 'c0ed455c18e5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
