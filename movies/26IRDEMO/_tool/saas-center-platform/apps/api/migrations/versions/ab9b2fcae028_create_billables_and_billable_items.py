"""create billables and billable_items tables

Revision ID: ab9b2fcae028
Revises: 1184902167e4
Create Date: 2026-04-10 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'ab9b2fcae028'
down_revision: Union[str, Sequence[str], None] = '1184902167e4'
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
    """Upgrade schema."""
    # ── billables ──
    if not _table_exists("billables"):
        op.create_table(
            'billables',
            sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID'),
            sa.Column('client_id', sa.String(length=36), nullable=False, comment='내담자 ID'),
            sa.Column('billable_date', sa.Date(), nullable=False, comment='청구 일자'),
            sa.Column('total_amount', sa.Integer(), nullable=False, server_default='0', comment='총 금액 (= SUM(items.amount))'),
            sa.Column('paid_amount', sa.Integer(), nullable=False, server_default='0', comment='결제 금액 (= SUM(payments.amount))'),
            sa.Column('unpaid_amount', sa.Integer(), nullable=False, server_default='0', comment='미수금 (= total - paid)'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='draft', comment='상태: draft, issued, paid, overdue'),
            sa.Column('issued_at', sa.DateTime(), nullable=True, comment='발행 시각 (UTC)'),
            sa.Column('due_date', sa.Date(), nullable=True, comment='납부 기한'),
            sa.Column('notes', sa.Text(), nullable=True, comment='메모'),
            sa.Column('created_by', sa.String(length=36), nullable=False, comment='생성자 account_id'),
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )

    if not _index_exists("idx_billables_center_client"):
        op.create_index(
            'idx_billables_center_client',
            'billables',
            ['center_id', 'client_id'],
            postgresql_where=sa.text('deleted_at IS NULL'),
        )
    if not _index_exists("idx_billables_center_status"):
        op.create_index(
            'idx_billables_center_status',
            'billables',
            ['center_id', 'status'],
            postgresql_where=sa.text('deleted_at IS NULL'),
        )

    # ── billable_items ──
    if not _table_exists("billable_items"):
        op.create_table(
            'billable_items',
            sa.Column('billable_id', sa.String(length=36), nullable=False, comment='청구서 ID'),
            sa.Column('item_type', sa.String(length=20), nullable=False, comment='항목 유형: service, product, package'),
            sa.Column('item_id', sa.String(length=36), nullable=True, comment='서비스/상품 참조 ID (옵셔널)'),
            sa.Column('price_list_id', sa.String(length=36), nullable=True, comment='단가표 참조 ID (스냅샷용)'),
            sa.Column('description', sa.String(length=200), nullable=False, comment='항목 설명'),
            sa.Column('quantity', sa.Integer(), nullable=False, server_default='1', comment='수량'),
            sa.Column('unit_price', sa.Integer(), nullable=False, server_default='0', comment='단가'),
            sa.Column('amount', sa.Integer(), nullable=False, server_default='0', comment='금액 (= quantity × unit_price)'),
            sa.Column('provided_at', sa.DateTime(), nullable=True, comment='서비스 제공 일시 (UTC)'),
            sa.Column('notes', sa.Text(), nullable=True, comment='메모'),
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )

    if not _index_exists("idx_billable_items_billable"):
        op.create_index(
            'idx_billable_items_billable',
            'billable_items',
            ['billable_id'],
            postgresql_where=sa.text('deleted_at IS NULL'),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_billable_items_billable', table_name='billable_items')
    op.drop_table('billable_items')
    op.drop_index('idx_billables_center_status', table_name='billables')
    op.drop_index('idx_billables_center_client', table_name='billables')
    op.drop_table('billables')
