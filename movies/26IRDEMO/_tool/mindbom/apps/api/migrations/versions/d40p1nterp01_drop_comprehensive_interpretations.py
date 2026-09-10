"""drop comprehensive_interpretations (구 통합해석 모듈 폐기)

종합보고서 대상은 case(묶음) 단위로 확정됐다. 구 모듈은 대상을 client_id로
유도해(`_list_eligible_exams(client_id)`) 그 원칙과 어긋났고, 같은 개념을
`comprehensive_reports`가 이미 조인 테이블로 명시 보관하고 있었다.
프론트 호출 0건 · 데이터 0행이라 그대로 걷어낸다.

근거: docs/온톨로지/검사축-구현방안.md §5.5 (묶음 소유는 플랫폼 case)

Revision ID: d40p1nterp01
Revises: 45bef364d427
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'd40p1nterp01'
down_revision = '45bef364d427'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(
        'ix_comprehensive_interpretations_client_id',
        table_name='comprehensive_interpretations',
    )
    op.drop_index(
        'ix_comprehensive_interpretations_institution_id',
        table_name='comprehensive_interpretations',
    )
    op.drop_table('comprehensive_interpretations')


def downgrade() -> None:
    # 원본 생성 마이그레이션(c0mprehensive01)의 upgrade와 같아야 한다
    # — server_default·comment까지 그대로 복원한다.
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
