"""merge heads before billable

Revision ID: 1184902167e4
Revises: d7e3cfb3cf41, fcdae1c39850
Create Date: 2026-04-10 13:23:31.738118

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1184902167e4'
down_revision: Union[str, Sequence[str], None] = ('d7e3cfb3cf41', 'fcdae1c39850')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
