"""add ai_analysis_jobs table

Revision ID: 45bef364d427
Revises: a1c0mprehen51
Create Date: 2026-08-10 14:17:03.613234

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '45bef364d427'
down_revision: Union[str, None] = 'a1c0mprehen51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # autogenerate가 잡아낸 컬럼 코멘트 변경(comprehensive_interpretations.per_exam,
    # rorschach_regions.area_code)은 이 작업과 무관해 제외했다.
    # 코멘트만 어긋난 것이라 동작에는 영향이 없다.
    op.create_table('ai_analysis_jobs',
    sa.Column('examination_id', sa.String(length=36), nullable=False, comment='검사 ID'),
    sa.Column('module', sa.String(length=20), nullable=False, comment='검사 모듈: htp|rorschach|sct'),
    sa.Column('scope', sa.String(length=64), nullable=False, comment='분석 범위: session 또는 부분 식별자(로르샤하 region id 등)'),
    sa.Column('status', sa.String(length=20), nullable=False, comment='running|succeeded|failed'),
    sa.Column('started_at', sa.DateTime(), nullable=False, comment='시작 시각 (UTC)'),
    sa.Column('finished_at', sa.DateTime(), nullable=True, comment='종료 시각 (UTC)'),
    sa.Column('error_message', sa.Text(), nullable=True, comment='실패 사유'),
    sa.Column('ai_model_version', sa.String(length=50), nullable=True, comment='사용한 AI 모델 버전 (SaMD 추적)'),
    sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
    sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_analysis_jobs_examination_id'), 'ai_analysis_jobs', ['examination_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_analysis_jobs_examination_id'), table_name='ai_analysis_jobs')
    op.drop_table('ai_analysis_jobs')
