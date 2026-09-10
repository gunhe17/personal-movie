"""add discount_amount to billables

Revision ID: 47d8763dc43a
Revises: 4f15ca08c07d
Create Date: 2026-04-21 12:19:43.207585

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '47d8763dc43a'
down_revision: Union[str, Sequence[str], None] = '4f15ca08c07d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'billables',
        sa.Column(
            'discount_amount',
            sa.Integer(),
            nullable=False,
            server_default='0',
            comment='청구서 전체 할인액 (묶음 할인 등)',
        ),
    )
    op.alter_column(
        'billables',
        'total_amount',
        existing_type=sa.INTEGER(),
        comment='총 금액 (= SUM(items.amount) - discount_amount)',
        existing_comment='총 금액 (= SUM(items.amount))',
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        'billables',
        'total_amount',
        existing_type=sa.INTEGER(),
        comment='총 금액 (= SUM(items.amount))',
        existing_comment='총 금액 (= SUM(items.amount) - discount_amount)',
        existing_nullable=False,
    )
    op.drop_column('billables', 'discount_amount')
