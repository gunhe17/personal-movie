"""add_client_voucher_amount_columns

Revision ID: b5aa0037412f
Revises: 1572993b0d9e
Create Date: 2026-05-21 16:48:26.448081

ClientVoucher에 금액 추적 컬럼 추가 (옵션, nullable).
- total_amount: 발급 시점 잔여 금액 원액
- remaining_amount: 잔여 금액 (청구 차감 시 자동 감소, 음수 허용)

참조: docs/voucher/redesign-2026-05.md
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5aa0037412f'
down_revision: Union[str, Sequence[str], None] = '1572993b0d9e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'client_vouchers',
        sa.Column(
            'total_amount',
            sa.Integer(),
            nullable=True,
            comment='발급 시점 잔여 금액 원액 (옵션, 0 이상)',
        ),
    )
    op.add_column(
        'client_vouchers',
        sa.Column(
            'remaining_amount',
            sa.Integer(),
            nullable=True,
            comment='잔여 금액 (청구 시 subsidy_amount만큼 자동 차감, 음수 허용)',
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('client_vouchers', 'remaining_amount')
    op.drop_column('client_vouchers', 'total_amount')
