"""add_field_note_pipeline_columns

Revision ID: 2e144430deb6
Revises: 7fad8501fb48
Create Date: 2026-03-30 18:27:12.044986

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e144430deb6'
down_revision: Union[str, Sequence[str], None] = '7fad8501fb48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('field_notes', sa.Column('processing_status', sa.String(length=20), server_default='idle', nullable=False, comment='파이프라인 상태 (idle, processing, completed, failed)'))
    op.add_column('field_notes', sa.Column('processing_step', sa.String(length=30), nullable=True, comment='현재 진행 단계 (transcribing, refining, summarizing, generating_note)'))
    op.add_column('field_notes', sa.Column('failed_step', sa.String(length=30), nullable=True, comment='실패한 단계 (재시도용)'))
    op.add_column('field_notes', sa.Column('refined_transcript', sa.Text(), nullable=True, comment='LLM 보정된 전사본 (JSON: [{speaker, text, start, end}])'))
    op.add_column('field_notes', sa.Column('refinement_model', sa.String(length=50), nullable=True, comment='보정에 사용된 LLM 모델명'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('field_notes', 'refinement_model')
    op.drop_column('field_notes', 'refined_transcript')
    op.drop_column('field_notes', 'failed_step')
    op.drop_column('field_notes', 'processing_step')
    op.drop_column('field_notes', 'processing_status')
