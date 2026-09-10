"""add_notice_reads_table

Revision ID: dc33403b8798
Revises: 6b36466141ef
Create Date: 2026-03-12 10:36:11.597905

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'dc33403b8798'
down_revision: Union[str, Sequence[str], None] = '6b36466141ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('notice_reads',
    sa.Column('notice_id', sa.String(length=36), nullable=False, comment='공지사항 ID'),
    sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID (비정규화, 집계용)'),
    sa.Column('member_id', sa.String(length=36), nullable=False, comment='읽은 멤버 ID'),
    sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
    sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('notice_id', 'member_id', name='uq_notice_reads_notice_member'),
    )
    op.create_index('idx_notice_reads_notice', 'notice_reads', ['notice_id'], unique=False)
    op.create_index('idx_notice_reads_center', 'notice_reads', ['notice_id', 'center_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_notice_reads_center', table_name='notice_reads')
    op.drop_index('idx_notice_reads_notice', table_name='notice_reads')
    op.drop_table('notice_reads')
