"""add_field_note_summary_and_diarization

Revision ID: 3fa4c1fc0511
Revises: 3c0a48bd95a0
Create Date: 2026-03-30 15:40:43.853346

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3fa4c1fc0511'
down_revision: Union[str, Sequence[str], None] = '3c0a48bd95a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # FieldNote: AI 요약 관련 컬럼
    op.add_column('field_notes', sa.Column('summary', sa.Text(), nullable=True, comment='AI 생성 요약'))
    op.add_column('field_notes', sa.Column('summary_status', sa.String(length=20), server_default='none', nullable=False, comment='요약 상태 (none, generating, completed, failed)'))
    op.add_column('field_notes', sa.Column('summary_generated_at', sa.DateTime(), nullable=True, comment='요약 생성 시각'))
    op.add_column('field_notes', sa.Column('summary_model', sa.String(length=50), nullable=True, comment='요약에 사용된 LLM 모델명'))

    # FieldNoteAudio: 화자 분리 관련 컬럼
    op.add_column('field_note_audios', sa.Column('diarized_transcript', sa.Text(), nullable=True, comment='화자 분리 STT 결과 (JSON)'))
    op.add_column('field_note_audios', sa.Column('stt_model_used', sa.String(length=50), nullable=True, comment='사용된 STT 모델명'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('field_note_audios', 'stt_model_used')
    op.drop_column('field_note_audios', 'diarized_transcript')
    op.drop_column('field_notes', 'summary_model')
    op.drop_column('field_notes', 'summary_generated_at')
    op.drop_column('field_notes', 'summary_status')
    op.drop_column('field_notes', 'summary')
