"""add nonverbal_markers and counseling_case_analyses

Revision ID: a3f2e7b8c910
Revises: 1be795345590
Create Date: 2026-04-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a3f2e7b8c910'
down_revision: Union[str, Sequence[str], None] = '1be795345590'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. FieldNote에 nonverbal_markers 컬럼 추가
    op.add_column(
        'field_notes',
        sa.Column(
            'nonverbal_markers',
            sa.Text(),
            nullable=True,
            comment='비언어적 마커 (JSON: [{type, start, end, duration}])',
        ),
    )

    # 2. counseling_case_analyses 테이블 생성
    op.create_table(
        'counseling_case_analyses',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID (UUID)'),
        sa.Column('counseling_case_id', sa.String(length=36), nullable=False, comment='상담 케이스 ID (UUID)'),
        sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='분석 결과 (recurring_themes, emotional_trajectory 등)'),
        sa.Column('session_count', sa.Integer(), nullable=False, comment='분석에 포함된 완료 세션 수'),
        sa.Column('model_used', sa.String(length=80), nullable=True, comment='사용된 LLM 모델명'),
        sa.Column('triggered_by', sa.String(length=36), nullable=False, comment='분석 실행자 (Member UUID)'),
        sa.Column('input_tokens', sa.Integer(), nullable=False, comment='LLM 입력 토큰 수'),
        sa.Column('output_tokens', sa.Integer(), nullable=False, comment='LLM 출력 토큰 수'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_case_analysis_center', 'counseling_case_analyses', ['center_id'])
    op.create_index('idx_case_analysis_case', 'counseling_case_analyses', ['counseling_case_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_case_analysis_case', table_name='counseling_case_analyses')
    op.drop_index('idx_case_analysis_center', table_name='counseling_case_analyses')
    op.drop_table('counseling_case_analyses')
    op.drop_column('field_notes', 'nonverbal_markers')
