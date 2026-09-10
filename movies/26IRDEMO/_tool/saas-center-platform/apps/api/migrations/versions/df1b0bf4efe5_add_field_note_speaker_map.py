"""add_field_note_speaker_map

Revision ID: df1b0bf4efe5
Revises: 15b78cd6c358
Create Date: 2026-03-31 16:37:04.556471

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df1b0bf4efe5'
down_revision: Union[str, Sequence[str], None] = '15b78cd6c358'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('field_notes', sa.Column('speaker_map', sa.Text(), nullable=True, comment='화자 이름 매핑 (JSON: {speaker_id: display_name})'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('field_notes', 'speaker_map')
