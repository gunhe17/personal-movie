"""drop_client_voucher_case_id

Revision ID: 1572993b0d9e
Revises: c3e7b1d9f4a2
Create Date: 2026-05-21 15:37:17.904644

ClientVoucher의 case 직접 연결 제거 (v3 단순화).
- 사용 증빙은 BillableItem.client_voucher_id로 추적
- 기존 case_id 데이터는 BillableItem.related_case_id가 같은 정보를 보존 중

참조: docs/voucher/redesign-2026-05.md
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1572993b0d9e'
down_revision: Union[str, Sequence[str], None] = 'c3e7b1d9f4a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. 인덱스 / partial unique 제약 제거
    op.execute(
        "DROP INDEX IF EXISTS uq_client_vouchers_case_client_active"
    )
    op.execute("DROP INDEX IF EXISTS idx_client_vouchers_case")
    # 2. 컬럼 drop
    op.drop_column('client_vouchers', 'case_id')


def downgrade() -> None:
    """Downgrade schema.

    주의: 컬럼·인덱스만 복원되며 과거 case_id 데이터는 NULL이다.
    필요한 경우 BillableItem.related_case_id로부터 재구성 가능.
    """
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
        postgresql_where='deleted_at IS NULL',
    )
    op.create_index(
        'uq_client_vouchers_case_client_active',
        'client_vouchers',
        ['case_id', 'client_id'],
        unique=True,
        postgresql_where='deleted_at IS NULL AND case_id IS NOT NULL',
    )
