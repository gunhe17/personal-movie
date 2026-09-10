"""add payments table (Phase 3)

Revision ID: 2c89272dd309
Revises: 25d69e8bef48
Create Date: 2026-04-14 11:56:29.485853

멱등성: 이미 수동으로 생성되었거나 autogenerate로 만들어진 경우 스킵.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c89272dd309'
down_revision: Union[str, Sequence[str], None] = '25d69e8bef48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :t)"
        ),
        {"t": table_name},
    )
    return result.scalar()


def _index_exists(index_name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pg_indexes "
            "WHERE indexname = :i)"
        ),
        {"i": index_name},
    )
    return result.scalar()


def upgrade() -> None:
    if not _table_exists("payments"):
        op.create_table(
            'payments',
            sa.Column('billable_id', sa.String(length=36), nullable=False, comment='청구서 ID'),
            sa.Column('amount', sa.Integer(), nullable=False, comment='결제 금액'),
            sa.Column('payment_method', sa.String(length=20), nullable=False, comment='결제 수단: card, transfer'),
            sa.Column('paid_at', sa.DateTime(), nullable=False, comment='결제 일시 (UTC)'),
            sa.Column('receipt_number', sa.String(length=50), nullable=True, comment='영수증 번호'),
            sa.Column('notes', sa.Text(), nullable=True, comment='메모'),
            sa.Column('created_by', sa.String(length=36), nullable=False, comment='생성자 account_id'),
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )

    if not _index_exists("idx_payments_billable"):
        op.create_index(
            'idx_payments_billable',
            'payments',
            ['billable_id'],
            postgresql_where=sa.text('deleted_at IS NULL'),
        )


def downgrade() -> None:
    if _index_exists("idx_payments_billable"):
        op.drop_index('idx_payments_billable', table_name='payments')
    if _table_exists("payments"):
        op.drop_table('payments')
