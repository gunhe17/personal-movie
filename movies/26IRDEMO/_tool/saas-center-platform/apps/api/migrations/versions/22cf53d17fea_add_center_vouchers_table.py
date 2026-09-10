"""add center_vouchers table

Revision ID: 22cf53d17fea
Revises: 1a0dd3a01b98
Create Date: 2026-05-18 17:13:55.681751

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '22cf53d17fea'
down_revision: Union[str, Sequence[str], None] = '1a0dd3a01b98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'center_vouchers',
        sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID'),
        sa.Column('catalog_id', sa.String(length=36), nullable=False, comment='카탈로그 voucher.id (앱레벨 FK)'),
        sa.Column(
            'provider_registration_no',
            sa.String(length=50),
            nullable=True,
            comment='제공기관 등록번호 (사업별 다름, 청구 시 필요)',
        ),
        sa.Column(
            'unit_price',
            sa.Integer(),
            nullable=True,
            comment='회기당 단가 (원) — 참고용. 실제 결제는 billing.Payment 수동 입력',
        ),
        sa.Column(
            'default_total_sessions',
            sa.Integer(),
            nullable=True,
            comment='기본 총 회기 (내담자 발급 시 UI 자동 채움 힌트)',
        ),
        sa.Column(
            'is_active',
            sa.Boolean(),
            server_default='true',
            nullable=False,
            comment='취급 활성 여부',
        ),
        sa.Column('notes', sa.Text(), nullable=True, comment='센터 내부 메모'),
        sa.Column('created_by', sa.String(length=36), nullable=False, comment='최초 생성자 account_id'),
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
        sa.UniqueConstraint('center_id', 'catalog_id', name='uq_center_vouchers_center_catalog'),
    )
    op.create_index(
        'idx_center_vouchers_center_active',
        'center_vouchers',
        ['center_id', 'is_active'],
        unique=False,
        postgresql_where='deleted_at IS NULL',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        'idx_center_vouchers_center_active',
        table_name='center_vouchers',
        postgresql_where='deleted_at IS NULL',
    )
    op.drop_table('center_vouchers')
