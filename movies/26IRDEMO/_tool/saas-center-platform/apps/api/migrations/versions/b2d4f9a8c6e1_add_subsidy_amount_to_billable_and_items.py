"""add subsidy_amount to billable and billable_items

Revision ID: b2d4f9a8c6e1
Revises: a1c5e8d2b9f3
Create Date: 2026-05-20 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2d4f9a8c6e1'
down_revision: Union[str, Sequence[str], None] = 'a1c5e8d2b9f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'billable_items',
        sa.Column(
            'subsidy_amount',
            sa.Integer(),
            nullable=False,
            server_default='0',
            comment='바우처 지원금 (사용자 입력, amount에서 차감되어 본인부담금 계산)',
        ),
    )
    op.add_column(
        'billables',
        sa.Column(
            'subsidy_amount',
            sa.Integer(),
            nullable=False,
            server_default='0',
            comment='청구서 전체 지원금 합계 (= SUM(items.subsidy_amount))',
        ),
    )


def downgrade() -> None:
    op.drop_column('billables', 'subsidy_amount')
    op.drop_column('billable_items', 'subsidy_amount')
