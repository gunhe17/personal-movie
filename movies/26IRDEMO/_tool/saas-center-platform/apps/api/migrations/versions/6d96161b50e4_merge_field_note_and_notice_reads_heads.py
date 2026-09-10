"""merge field_note and notice_reads heads

Revision ID: 6d96161b50e4
Revises: 5449b0a5e1a2, dc33403b8798
Create Date: 2026-03-16 17:49:18.445611

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6d96161b50e4'
down_revision: Union[str, Sequence[str], None] = ('5449b0a5e1a2', 'dc33403b8798')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
