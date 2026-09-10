"""merge ledger and voucher extraction progress heads

Revision ID: 23c7b2c9e958
Revises: b7c1d94ae210, f6929cb25a67
Create Date: 2026-07-30 16:14:51.333439

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '23c7b2c9e958'
down_revision: Union[str, Sequence[str], None] = ('b7c1d94ae210', 'f6929cb25a67')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
