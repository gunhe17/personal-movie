"""add price_lists table

Revision ID: c8b4d1f02a3e
Revises: a3e7c1d92f48
Create Date: 2026-04-08 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c8b4d1f02a3e'
down_revision: Union[str, Sequence[str], None] = 'a3e7c1d92f48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    """테이블 존재 여부 확인 (수동 생성된 경우 대응)"""
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
    """인덱스 존재 여부 확인"""
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
    if not _table_exists("price_lists"):
        op.create_table(
            'price_lists',
            sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID'),
            sa.Column('service_type', sa.String(length=20), nullable=False, comment='서비스 유형: counseling, assessment, package'),
            sa.Column('service_name', sa.String(length=100), nullable=False, comment="서비스명 (예: 'MMPI-2 검사', '성인 개인상담 50분')"),
            sa.Column('unit_price', sa.Integer(), nullable=False, server_default='0', comment='단가 (원)'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true(), comment='활성화 여부'),
            sa.Column('notes', sa.Text(), nullable=True, comment='메모'),
            sa.Column('created_by', sa.String(length=36), nullable=False, comment='최초 생성자 account_id'),
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )

    if not _index_exists("idx_price_lists_center_active_type"):
        op.create_index(
            'idx_price_lists_center_active_type',
            'price_lists',
            ['center_id', 'is_active', 'service_type'],
            postgresql_where=sa.text('deleted_at IS NULL'),
        )
    if not _index_exists("idx_price_lists_center_name"):
        op.create_index(
            'idx_price_lists_center_name',
            'price_lists',
            ['center_id', 'service_name'],
            postgresql_where=sa.text('deleted_at IS NULL'),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_price_lists_center_name', table_name='price_lists')
    op.drop_index('idx_price_lists_center_active_type', table_name='price_lists')
    op.drop_table('price_lists')
