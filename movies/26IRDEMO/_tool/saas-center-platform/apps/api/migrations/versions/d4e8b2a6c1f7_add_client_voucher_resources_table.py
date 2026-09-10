"""add client_voucher_resources table

Revision ID: d4e8b2a6c1f7
Revises: b7f2a1c0d9e3
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4e8b2a6c1f7'
down_revision: Union[str, Sequence[str], None] = 'b7f2a1c0d9e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'client_voucher_resources',
        sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID (RLS)'),
        sa.Column('client_voucher_id', sa.String(length=36), nullable=False, comment='내담자 바우처 ID (앱레벨 FK)'),
        sa.Column('resource_id', sa.String(length=36), nullable=False, comment='리소스 ID (form instance 등)'),
        sa.Column('resource_type', sa.String(length=20), nullable=False, comment='리소스 유형 (form_instance, document)'),
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('client_voucher_id', 'resource_id', name='uq_client_voucher_resource'),
    )
    op.create_index('ix_client_voucher_resources_voucher', 'client_voucher_resources', ['client_voucher_id'], unique=False)
    op.create_index('ix_client_voucher_resources_center', 'client_voucher_resources', ['center_id'], unique=False)
    op.create_index('ix_client_voucher_resources_type', 'client_voucher_resources', ['client_voucher_id', 'resource_type'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_client_voucher_resources_type', table_name='client_voucher_resources')
    op.drop_index('ix_client_voucher_resources_center', table_name='client_voucher_resources')
    op.drop_index('ix_client_voucher_resources_voucher', table_name='client_voucher_resources')
    op.drop_table('client_voucher_resources')
