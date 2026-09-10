"""extend_llm_calls_for_field_note_tracking

Revision ID: c89a87164ba0
Revises: b6de9afef0f8
Create Date: 2026-04-01 15:04:10.782348

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

# revision identifiers, used by Alembic.
revision: str = 'c89a87164ba0'
down_revision: Union[str, Sequence[str], None] = 'b6de9afef0f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    """테이블에 컬럼이 이미 존재하는지 확인."""
    bind = op.get_bind()
    inspector = sa_inspect(bind)
    columns = [c['name'] for c in inspector.get_columns(table)]
    return column in columns


def _has_index(table: str, index_name: str) -> bool:
    """테이블에 인덱스가 이미 존재하는지 확인."""
    bind = op.get_bind()
    inspector = sa_inspect(bind)
    indexes = [idx['name'] for idx in inspector.get_indexes(table)]
    return index_name in indexes


def upgrade() -> None:
    """llm_calls 테이블 확장: 필드노트 파이프라인 비용 추적 지원."""
    # session_id를 nullable로 변경 (field_note 호출 시 null)
    op.alter_column('llm_calls', 'session_id', existing_type=sa.String(36), nullable=True)

    # 신규 컬럼 추가 (이미 존재하면 skip)
    if not _has_column('llm_calls', 'center_id'):
        op.add_column('llm_calls', sa.Column('center_id', sa.String(36), nullable=True, comment='센터 ID (field_note 호출 시 직접 참조)'))
    if not _has_column('llm_calls', 'source_type'):
        op.add_column('llm_calls', sa.Column('source_type', sa.String(20), nullable=False, server_default='agent', comment='호출 출처 (agent | field_note)'))
    if not _has_column('llm_calls', 'source_id'):
        op.add_column('llm_calls', sa.Column('source_id', sa.String(36), nullable=True, comment='출처 엔티티 ID (field_note_id 등)'))
    if not _has_column('llm_calls', 'purpose'):
        op.add_column('llm_calls', sa.Column('purpose', sa.String(50), nullable=True, comment='호출 용도 (skill_selection, field_note_stt_diarize 등)'))
    if not _has_column('llm_calls', 'audio_duration_seconds'):
        op.add_column('llm_calls', sa.Column('audio_duration_seconds', sa.Float(), nullable=True, comment='STT 오디오 길이 (초, 분단위 과금용)'))

    # 인덱스 추가 (이미 존재하면 skip)
    if not _has_index('llm_calls', 'ix_llm_calls_center_id'):
        op.create_index('ix_llm_calls_center_id', 'llm_calls', ['center_id'])
    if not _has_index('llm_calls', 'ix_llm_calls_source_type'):
        op.create_index('ix_llm_calls_source_type', 'llm_calls', ['source_type'])
    if not _has_index('llm_calls', 'ix_llm_calls_source_id'):
        op.create_index('ix_llm_calls_source_id', 'llm_calls', ['source_id'])
    if not _has_index('llm_calls', 'ix_llm_calls_purpose'):
        op.create_index('ix_llm_calls_purpose', 'llm_calls', ['purpose'])


def downgrade() -> None:
    """llm_calls 테이블 원복."""
    op.drop_index('ix_llm_calls_purpose', table_name='llm_calls')
    op.drop_index('ix_llm_calls_source_id', table_name='llm_calls')
    op.drop_index('ix_llm_calls_source_type', table_name='llm_calls')
    op.drop_index('ix_llm_calls_center_id', table_name='llm_calls')

    op.drop_column('llm_calls', 'audio_duration_seconds')
    op.drop_column('llm_calls', 'purpose')
    op.drop_column('llm_calls', 'source_id')
    op.drop_column('llm_calls', 'source_type')
    op.drop_column('llm_calls', 'center_id')

    op.alter_column('llm_calls', 'session_id', existing_type=sa.String(36), nullable=False)
