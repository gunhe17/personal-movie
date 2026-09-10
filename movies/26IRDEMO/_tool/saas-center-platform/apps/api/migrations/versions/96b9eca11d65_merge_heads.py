"""merge_heads

Revision ID: 96b9eca11d65
Revises: 4cfd63d2af63, b7e9f3a2c8d1
Create Date: 2026-05-27 15:14:53.809438

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '96b9eca11d65'
down_revision: Union[str, Sequence[str], None] = ('4cfd63d2af63', 'b7e9f3a2c8d1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
