"""merge subscription and billing_discount heads

Revision ID: 90d41b50a0b5
Revises: 581713c82015, 58353105f3d5
Create Date: 2026-04-24 11:07:24.352445

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '90d41b50a0b5'
down_revision: Union[str, Sequence[str], None] = ('581713c82015', '58353105f3d5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
