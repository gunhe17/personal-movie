"""add credit_balances table

Revision ID: b61b734bfbb5
Revises: 4f15ca08c07d
Create Date: 2026-04-21 14:00:42.149246

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b61b734bfbb5'
down_revision: Union[str, Sequence[str], None] = '4f15ca08c07d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    """테이블이 이미 존재하는지 확인."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :table"
        ),
        {"table": table},
    )
    return result.scalar() is not None


def upgrade() -> None:
    """Upgrade schema."""
    if _table_exists('credit_balances'):
        return

    op.create_table('credit_balances',
        sa.Column('center_id', sa.String(length=36), nullable=False),
        sa.Column('plan_type', sa.String(length=20), server_default='pro', nullable=False),
        sa.Column('credit_limit', sa.Integer(), server_default='1500', nullable=False),
        sa.Column('credit_used', sa.Integer(), server_default='0', nullable=False),
        sa.Column('period_start', sa.DateTime(), nullable=False),
        sa.Column('period_end', sa.DateTime(), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_credit_balances_center_id'), 'credit_balances', ['center_id'], unique=False)
    op.create_index('uq_credit_balance_active', 'credit_balances', ['center_id'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('uq_credit_balance_active', table_name='credit_balances')
    op.drop_index(op.f('ix_credit_balances_center_id'), table_name='credit_balances')
    op.drop_table('credit_balances')
