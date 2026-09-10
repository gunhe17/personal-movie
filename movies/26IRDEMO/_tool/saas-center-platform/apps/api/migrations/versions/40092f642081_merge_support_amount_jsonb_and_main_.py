"""merge support_amount jsonb and main heads

Revision ID: 40092f642081
Revises: 96b9eca11d65, d3f7a2c91e54
Create Date: 2026-05-28 05:30:11.795448

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '40092f642081'
down_revision: Union[str, Sequence[str], None] = ('96b9eca11d65', 'd3f7a2c91e54')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
