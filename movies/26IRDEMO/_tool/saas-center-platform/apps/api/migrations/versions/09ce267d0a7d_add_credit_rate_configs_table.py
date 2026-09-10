"""add credit_rate_configs table

Revision ID: 09ce267d0a7d
Revises: 2b277e784ffb
Create Date: 2026-05-20 20:10:10.140405

"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '09ce267d0a7d'
down_revision: Union[str, Sequence[str], None] = '2b277e784ffb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """credit_rate_configs 테이블 생성 + 초기 레코드(2000 tokens/credit) 삽입."""
    op.create_table('credit_rate_configs',
        sa.Column('tokens_per_credit', sa.Integer(), nullable=False, comment='1크레딧당 토큰 수'),
        sa.Column('effective_from', sa.DateTime(), nullable=False, comment='적용 시작 시점 (UTC)'),
        sa.Column('effective_to', sa.DateTime(), nullable=True, comment='적용 종료 시점 (NULL=현재 활성)'),
        sa.Column('changed_by', sa.String(length=36), nullable=True, comment='변경한 관리자 account_id'),
        sa.Column('reason', sa.Text(), nullable=True, comment='변경 사유'),
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(
        'uq_credit_rate_active', 'credit_rate_configs', ['id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL AND effective_to IS NULL'),
    )

    # 초기 비율 레코드 삽입 (2000 tokens = 1 credit, 시스템 시작 시점)
    op.execute(
        sa.text(
            "INSERT INTO credit_rate_configs (id, tokens_per_credit, effective_from, reason, created_at, updated_at) "
            "VALUES (:id, 2000, '2026-01-01 00:00:00', '초기 설정', now(), now())"
        ).bindparams(id=str(uuid4()))
    )


def downgrade() -> None:
    """credit_rate_configs 테이블 제거."""
    op.drop_index('uq_credit_rate_active', table_name='credit_rate_configs',
                  postgresql_where=sa.text('deleted_at IS NULL AND effective_to IS NULL'))
    op.drop_table('credit_rate_configs')
