"""add comprehensive_interpretations table (+ merge divergent heads)

검사별 해석 + 최종 종합 해석 저장 테이블 추가.
기존에 5개로 갈라진 head 리비전을 하나로 병합하며 테이블을 생성한다.

Revision ID: c0mprehensive01
Revises: 4acc6ede2e06, 0124eb87b4a9, 61a24c5d67bb, 8fd1440452c4, ba9c6943879d
Create Date: 2026-07-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c0mprehensive01'
down_revision: Union[str, Sequence[str], None] = (
    '4acc6ede2e06',
    '0124eb87b4a9',
    '61a24c5d67bb',
    '8fd1440452c4',
    'ba9c6943879d',
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'comprehensive_interpretations',
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.Column('institution_id', sa.String(length=36), nullable=False),
        sa.Column('client_id', sa.String(length=36), nullable=False),
        sa.Column('examiner_id', sa.String(length=36), nullable=False),
        sa.Column('examination_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='포함된 검사 ID 목록'),
        sa.Column('per_exam', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='검사별 해석'),
        sa.Column('comprehensive', sa.Text(), nullable=False, comment='최종 종합 해석 문단 (임상가용)'),
        sa.Column('plain_summary', sa.Text(), server_default='', nullable=False, comment='피검사자용 쉬운 설명 (비진단·순화 표현)'),
        sa.Column('key_findings', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='검사 전반 핵심 소견 목록'),
        sa.Column('ai_model_version', sa.String(length=50), nullable=True, comment='AI 모델 버전 (SaMD 추적)'),
        sa.Column('status', sa.String(length=20), nullable=False, comment='draft | confirmed'),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('confirmed_by', sa.String(length=36), nullable=True, comment='확정 임상가 Member ID'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_comprehensive_interpretations_institution_id',
        'comprehensive_interpretations', ['institution_id'],
    )
    op.create_index(
        'ix_comprehensive_interpretations_client_id',
        'comprehensive_interpretations', ['client_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_comprehensive_interpretations_client_id', table_name='comprehensive_interpretations')
    op.drop_index('ix_comprehensive_interpretations_institution_id', table_name='comprehensive_interpretations')
    op.drop_table('comprehensive_interpretations')
