"""add client_voucher_id to billable_items

Revision ID: a1c5e8d2b9f3
Revises: 07f44c12650a
Create Date: 2026-05-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c5e8d2b9f3'
down_revision: Union[str, Sequence[str], None] = '07f44c12650a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:table AND column_name=:column"
    ), {"table": table, "column": column})
    return result.scalar() is not None


def _index_exists(conn, name: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname=:name"
    ), {"name": name})
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    if not _column_exists(conn, "billable_items", "client_voucher_id"):
        op.add_column(
            'billable_items',
            sa.Column(
                'client_voucher_id',
                sa.String(length=36),
                nullable=True,
                comment='연결된 내담자 바우처 ID (앱레벨 FK). 청구 생성 시 1회 차감, 이후 변경 불가',
            ),
        )
    if not _index_exists(conn, "idx_billable_items_client_voucher"):
        op.create_index(
            'idx_billable_items_client_voucher',
            'billable_items',
            ['client_voucher_id'],
            unique=False,
            postgresql_where=sa.text('deleted_at IS NULL AND client_voucher_id IS NOT NULL'),
        )


def downgrade() -> None:
    op.drop_index('idx_billable_items_client_voucher', table_name='billable_items')
    op.drop_column('billable_items', 'client_voucher_id')
