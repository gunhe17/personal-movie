"""merge llm_calls and client_favorites heads

Revision ID: 812d1780e726
Revises: 1bb96269218f, e7a2c4f9b1d3
Create Date: 2026-05-21 22:42:04.696002

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '812d1780e726'
down_revision: Union[str, Sequence[str], None] = ('1bb96269218f', 'e7a2c4f9b1d3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
