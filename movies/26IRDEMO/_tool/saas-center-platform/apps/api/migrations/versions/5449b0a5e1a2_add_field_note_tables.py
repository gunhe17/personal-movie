"""add field_note tables

Revision ID: 5449b0a5e1a2
Revises: 4e1083a892f0
Create Date: 2026-03-16 17:20:47.860256

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5449b0a5e1a2'
down_revision: Union[str, Sequence[str], None] = '4e1083a892f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # field_notes
    op.create_table('field_notes',
        sa.Column('center_id', sa.VARCHAR(length=36), nullable=False, comment='센터 ID (UUID)'),
        sa.Column('schedule_id', sa.VARCHAR(length=36), nullable=False, comment='일정 ID (UUID)'),
        sa.Column('author_id', sa.VARCHAR(length=36), nullable=False, comment='작성자 ID (Member UUID)'),
        sa.Column('status', sa.VARCHAR(length=20), nullable=False, comment='상태 (recording, paused, completed)'),
        sa.Column('total_duration', sa.DOUBLE_PRECISION(precision=53), nullable=False, comment='총 녹음 시간 (초)'),
        sa.Column('id', sa.VARCHAR(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', postgresql.TIMESTAMP(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_field_notes_schedule_id', 'field_notes', ['schedule_id'], unique=False)
    op.create_index('ix_field_notes_center_id', 'field_notes', ['center_id'], unique=False)
    op.create_index('ix_field_notes_author_id', 'field_notes', ['author_id'], unique=False)
    op.create_index('idx_field_note_schedule', 'field_notes', ['schedule_id'], unique=False)
    op.create_index('idx_field_note_center', 'field_notes', ['center_id'], unique=False)
    op.create_index('idx_field_note_author', 'field_notes', ['author_id'], unique=False)

    # field_note_audios
    op.create_table('field_note_audios',
        sa.Column('field_note_id', sa.VARCHAR(length=36), nullable=False, comment='필드노트 ID (UUID)'),
        sa.Column('chunk_index', sa.INTEGER(), nullable=False, comment='청크 순서 (0부터)'),
        sa.Column('storage_path', sa.VARCHAR(length=500), nullable=False, comment='S3 저장 경로'),
        sa.Column('duration', sa.DOUBLE_PRECISION(precision=53), nullable=False, comment='오디오 길이 (초)'),
        sa.Column('transcript', sa.TEXT(), nullable=True, comment='STT 변환 텍스트'),
        sa.Column('transcript_status', sa.VARCHAR(length=20), nullable=False, comment='STT 상태 (pending, processing, completed, failed)'),
        sa.Column('id', sa.VARCHAR(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', postgresql.TIMESTAMP(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_field_note_audios_field_note_id', 'field_note_audios', ['field_note_id'], unique=False)
    op.create_index('idx_audio_field_note', 'field_note_audios', ['field_note_id'], unique=False)
    op.create_index('idx_audio_chunk', 'field_note_audios', ['field_note_id', 'chunk_index'], unique=False)

    # field_note_entries
    op.create_table('field_note_entries',
        sa.Column('field_note_id', sa.VARCHAR(length=36), nullable=False, comment='필드노트 ID (UUID)'),
        sa.Column('entry_type', sa.VARCHAR(length=20), nullable=False, comment='엔트리 타입 (memo, tag)'),
        sa.Column('tag_category', sa.VARCHAR(length=30), nullable=True, comment='태그 카테고리 (observation, behavior, emotion, other)'),
        sa.Column('content', sa.TEXT(), nullable=False, comment='메모/태그 내용'),
        sa.Column('timestamp_seconds', sa.DOUBLE_PRECISION(precision=53), nullable=False, comment='녹음 시작 기준 경과 시간 (초)'),
        sa.Column('id', sa.VARCHAR(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', postgresql.TIMESTAMP(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_field_note_entries_field_note_id', 'field_note_entries', ['field_note_id'], unique=False)
    op.create_index('idx_entry_timestamp', 'field_note_entries', ['field_note_id', 'timestamp_seconds'], unique=False)
    op.create_index('idx_entry_field_note', 'field_note_entries', ['field_note_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_entry_field_note', table_name='field_note_entries')
    op.drop_index('idx_entry_timestamp', table_name='field_note_entries')
    op.drop_index('ix_field_note_entries_field_note_id', table_name='field_note_entries')
    op.drop_table('field_note_entries')

    op.drop_index('idx_audio_chunk', table_name='field_note_audios')
    op.drop_index('idx_audio_field_note', table_name='field_note_audios')
    op.drop_index('ix_field_note_audios_field_note_id', table_name='field_note_audios')
    op.drop_table('field_note_audios')

    op.drop_index('idx_field_note_author', table_name='field_notes')
    op.drop_index('idx_field_note_center', table_name='field_notes')
    op.drop_index('idx_field_note_schedule', table_name='field_notes')
    op.drop_index('ix_field_notes_author_id', table_name='field_notes')
    op.drop_index('ix_field_notes_center_id', table_name='field_notes')
    op.drop_index('ix_field_notes_schedule_id', table_name='field_notes')
    op.drop_table('field_notes')
