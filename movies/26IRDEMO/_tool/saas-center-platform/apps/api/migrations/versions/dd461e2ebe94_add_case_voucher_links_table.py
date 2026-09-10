"""add case_voucher_links table

Revision ID: dd461e2ebe94
Revises: b732514a5ce7
Create Date: 2026-05-19 17:07:55.119314

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd461e2ebe94'
down_revision: Union[str, Sequence[str], None] = 'b732514a5ce7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'case_voucher_links',
        sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID'),
        sa.Column('case_id', sa.String(length=36), nullable=False, comment='상담 케이스 counseling_case.id'),
        sa.Column(
            'client_voucher_id',
            sa.String(length=36),
            nullable=False,
            comment='내담자 바우처 client_voucher.id',
        ),
        sa.Column('created_by', sa.String(length=36), nullable=False, comment='연결 생성자 account_id'),
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column(
            'created_at',
            sa.DateTime(),
            server_default=sa.text('now()'),
            nullable=False,
            comment='생성 시각 (UTC)',
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(),
            server_default=sa.text('now()'),
            nullable=False,
            comment='수정 시각 (UTC)',
        ),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id'),
    )
    # 한 케이스 = 한 바우처 (정책). soft-delete된 row는 제외하므로 partial unique index
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


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        'idx_case_voucher_links_center',
        table_name='case_voucher_links',
        postgresql_where='deleted_at IS NULL',
    )
    op.drop_index(
        'idx_case_voucher_links_voucher',
        table_name='case_voucher_links',
        postgresql_where='deleted_at IS NULL',
    )
    op.drop_index(
        'uq_case_voucher_links_case_active',
        table_name='case_voucher_links',
        postgresql_where='deleted_at IS NULL',
    )
    op.drop_table('case_voucher_links')
