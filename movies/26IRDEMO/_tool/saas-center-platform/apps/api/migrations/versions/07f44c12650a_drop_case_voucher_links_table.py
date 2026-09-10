"""merge case linkage into client_vouchers

Revision ID: 07f44c12650a
Revises: dd461e2ebe94
Create Date: 2026-05-19 17:36:15.186792

정책 변경: 케이스 ↔ 바우처 관계를 별도 매핑이 아닌
client_vouchers.case_id 컬럼으로 표현하도록 통합.

이 마이그레이션은 두 가지를 한꺼번에 처리한다:
1. case_voucher_links 테이블 drop
2. client_vouchers.case_id 컬럼(nullable) + 관련 인덱스 추가
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '07f44c12650a'
down_revision: Union[str, Sequence[str], None] = 'dd461e2ebe94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1) case_voucher_links 제거
    op.execute("DROP INDEX IF EXISTS idx_case_voucher_links_center")
    op.execute("DROP INDEX IF EXISTS idx_case_voucher_links_voucher")
    op.execute("DROP INDEX IF EXISTS uq_case_voucher_links_case_active")
    op.execute("DROP TABLE IF EXISTS case_voucher_links")

    # 2) client_vouchers에 case_id 컬럼 + 인덱스 추가
    op.add_column(
        'client_vouchers',
        sa.Column(
            'case_id',
            sa.String(length=36),
            nullable=True,
            comment='상담 케이스 counseling_case.id (앱레벨 FK, nullable)',
        ),
    )
    op.create_index(
        'idx_client_vouchers_case',
        'client_vouchers',
        ['case_id'],
        unique=False,
        postgresql_where='deleted_at IS NULL',
    )
    op.create_index(
        'uq_client_vouchers_case_client_active',
        'client_vouchers',
        ['case_id', 'client_id'],
        unique=True,
        postgresql_where='deleted_at IS NULL AND case_id IS NOT NULL',
    )


def downgrade() -> None:
    """Downgrade schema."""
    # 1) client_vouchers의 case_id 제거
    op.execute("DROP INDEX IF EXISTS uq_client_vouchers_case_client_active")
    op.execute("DROP INDEX IF EXISTS idx_client_vouchers_case")
    op.drop_column('client_vouchers', 'case_id')

    # 2) case_voucher_links 복원
    op.create_table(
        'case_voucher_links',
        sa.Column('center_id', sa.String(length=36), nullable=False),
        sa.Column('case_id', sa.String(length=36), nullable=False),
        sa.Column('client_voucher_id', sa.String(length=36), nullable=False),
        sa.Column('created_by', sa.String(length=36), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'uq_case_voucher_links_case_active',
        'case_voucher_links',
        ['case_id'],
        unique=True,
        postgresql_where='deleted_at IS NULL',
    )
    op.create_index(
        'idx_case_voucher_links_voucher',
        'case_voucher_links',
        ['client_voucher_id'],
        unique=False,
        postgresql_where='deleted_at IS NULL',
    )
    op.create_index(
        'idx_case_voucher_links_center',
        'case_voucher_links',
        ['center_id'],
        unique=False,
        postgresql_where='deleted_at IS NULL',
    )
