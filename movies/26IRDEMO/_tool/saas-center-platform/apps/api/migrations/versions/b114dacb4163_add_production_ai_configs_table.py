"""add production_ai_configs table

Revision ID: b114dacb4163
Revises: 33c7223f7029
Create Date: 2026-04-03 10:16:33.612936

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b114dacb4163'
down_revision: Union[str, Sequence[str], None] = '33c7223f7029'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'production_ai_configs',
        sa.Column('pipeline_step', sa.String(length=50), nullable=False,
                  comment='파이프라인 단계 (stt_diarize, refine, summary, counseling_note)'),
        sa.Column('model_name', sa.String(length=80), nullable=False,
                  comment='사용할 모델명'),
        sa.Column('provider', sa.String(length=30), nullable=False,
                  comment='제공사'),
        sa.Column('system_prompt', sa.Text(), nullable=True,
                  comment='시스템 프롬프트 (STT 단계는 null)'),
        sa.Column('user_prompt_template', sa.Text(), nullable=True,
                  comment='사용자 프롬프트 템플릿'),
        sa.Column('model_params', sa.Text(), nullable=True,
                  comment='모델 파라미터 (JSON)'),
        sa.Column('promoted_from_version_id', sa.String(length=36), nullable=True,
                  comment='Lab 프롬프트 버전 ID (추적용)'),
        sa.Column('promoted_by', sa.String(length=36), nullable=True,
                  comment='승격한 사용자 ID'),
        sa.Column('promoted_at', postgresql.TIMESTAMP(), nullable=True,
                  comment='승격 시각 (UTC)'),
        sa.Column('is_active', sa.Boolean(), nullable=False,
                  comment='활성 여부'),
        sa.Column('description', sa.Text(), nullable=True,
                  comment='변경 설명'),
        sa.Column('id', sa.String(length=36), nullable=False,
                  comment='UUID Primary Key'),
        sa.Column('created_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'),
                  nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'),
                  nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', postgresql.TIMESTAMP(), nullable=True,
                  comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_production_ai_configs_step_active',
        'production_ai_configs',
        ['pipeline_step', 'is_active'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_production_ai_configs_step_active', table_name='production_ai_configs')
    op.drop_table('production_ai_configs')
