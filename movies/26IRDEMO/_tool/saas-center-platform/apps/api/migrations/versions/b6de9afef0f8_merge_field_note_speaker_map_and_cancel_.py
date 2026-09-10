"""merge_field_note_speaker_map_and_cancel_reason

Revision ID: b6de9afef0f8
Revises: 118a315fbbeb, df1b0bf4efe5
Create Date: 2026-04-01 13:50:53.665513

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6de9afef0f8'
down_revision: Union[str, Sequence[str], None] = ('118a315fbbeb', 'df1b0bf4efe5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
