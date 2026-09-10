"""add client_vouchers table

Revision ID: b732514a5ce7
Revises: 22cf53d17fea
Create Date: 2026-05-19 16:55:44.008558

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b732514a5ce7'
down_revision: Union[str, Sequence[str], None] = '22cf53d17fea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'client_vouchers',
        sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID'),
        sa.Column('client_id', sa.String(length=36), nullable=False, comment='내담자 client.id (앱레벨 FK)'),
        sa.Column(
            'center_voucher_id',
            sa.String(length=36),
            nullable=False,
            comment='센터 취급 바우처 center_voucher.id (앱레벨 FK)',
        ),
        sa.Column('total_sessions', sa.Integer(), nullable=False, comment='총 회기'),
        sa.Column(
            'remaining_sessions',
            sa.Integer(),
            nullable=False,
            comment='잔여 회기 (수동 갱신, P3에서 자동화)',
        ),
        sa.Column('valid_from', sa.Date(), nullable=True, comment='유효기간 시작일'),
        sa.Column('valid_until', sa.Date(), nullable=True, comment='유효기간 종료일'),
        sa.Column('created_by', sa.String(length=36), nullable=False, comment='최초 발급자 account_id'),
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
    op.create_index(
        'idx_client_vouchers_client',
        'client_vouchers',
        ['client_id'],
        unique=False,
        postgresql_where='deleted_at IS NULL',
    )
    op.create_index(
        'idx_client_vouchers_center',
        'client_vouchers',
        ['center_id'],
        unique=False,
        postgresql_where='deleted_at IS NULL',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        'idx_client_vouchers_center',
        table_name='client_vouchers',
        postgresql_where='deleted_at IS NULL',
    )
    op.drop_index(
        'idx_client_vouchers_client',
        table_name='client_vouchers',
        postgresql_where='deleted_at IS NULL',
    )
    op.drop_table('client_vouchers')
