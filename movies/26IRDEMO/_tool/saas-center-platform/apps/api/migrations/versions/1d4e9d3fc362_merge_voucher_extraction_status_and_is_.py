"""merge voucher_extraction_status and is_certified heads

Revision ID: 1d4e9d3fc362
Revises: d33cc461bc56, e5b4c8a1f372
Create Date: 2026-05-28 08:46:54.396304

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1d4e9d3fc362'
down_revision: Union[str, Sequence[str], None] = ('d33cc461bc56', 'e5b4c8a1f372')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
