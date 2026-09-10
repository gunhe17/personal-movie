"""make_field_note_schedule_id_nullable

Revision ID: 15b78cd6c358
Revises: 473fc358a214
Create Date: 2026-03-31 11:47:28.141863

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '15b78cd6c358'
down_revision: Union[str, Sequence[str], None] = '473fc358a214'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """field_notes.schedule_id를 nullable로 변경 (바로 녹음 시작 지원)"""
    op.alter_column('field_notes', 'schedule_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=True,
               comment='일정 ID (UUID, nullable - 후속 연결 가능)',
               existing_comment='일정 ID (UUID)')


def downgrade() -> None:
    """field_notes.schedule_id를 NOT NULL로 복원"""
    op.alter_column('field_notes', 'schedule_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=False,
               comment='일정 ID (UUID)',
               existing_comment='일정 ID (UUID, nullable - 후속 연결 가능)')
