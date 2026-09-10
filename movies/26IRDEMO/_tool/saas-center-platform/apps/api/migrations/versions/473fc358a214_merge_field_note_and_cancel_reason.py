"""merge_field_note_and_cancel_reason

Revision ID: 473fc358a214
Revises: 2e144430deb6, a685618a4b17
Create Date: 2026-03-31 11:23:11.499916

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '473fc358a214'
down_revision: Union[str, Sequence[str], None] = ('2e144430deb6', 'a685618a4b17')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
