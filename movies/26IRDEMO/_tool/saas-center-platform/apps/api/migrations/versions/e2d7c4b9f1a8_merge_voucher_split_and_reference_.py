"""merge voucher_split and reference_segments heads

Revision ID: e2d7c4b9f1a8
Revises: a3f5c1d92b47, c3a7e1f9b2d4
Create Date: 2026-06-12 05:31:24.245822

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2d7c4b9f1a8'
down_revision: Union[str, Sequence[str], None] = ('a3f5c1d92b47', 'c3a7e1f9b2d4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
