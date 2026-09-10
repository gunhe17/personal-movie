"""add push_tokens table

FCM Web Push 토큰 관리 테이블

Revision ID: f7a4b9c1d3e5
Revises: e6a3b8c9d2f4
Create Date: 2026-03-05 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'f7a4b9c1d3e5'
down_revision: Union[str, Sequence[str], None] = 'e6a3b8c9d2f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": name}).scalar()


def _index_exists(name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :i)"
    ), {"i": name}).scalar()


def upgrade() -> None:
    """Create push_tokens table."""
    if not _table_exists('push_tokens'):
        op.create_table(
            'push_tokens',
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID'),
            sa.Column('account_id', sa.String(length=36), nullable=False, comment='사용자 account_id'),
            sa.Column('token', sa.String(length=512), nullable=False, comment='FCM Push Token'),
            sa.Column('device_info', sa.String(length=256), nullable=True, comment='브라우저/디바이스 식별 정보'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true'), comment='활성 상태'),
            sa.PrimaryKeyConstraint('id'),
        )
    if not _index_exists('ix_push_tokens_center_account'):
        op.create_index(
            'ix_push_tokens_center_account',
            'push_tokens',
            ['center_id', 'account_id'],
        )
    if not _index_exists('ix_push_tokens_token'):
        op.create_index(
            'ix_push_tokens_token',
            'push_tokens',
            ['token'],
            unique=True,
        )


def downgrade() -> None:
    """Drop push_tokens table."""
    op.drop_index('ix_push_tokens_token', table_name='push_tokens')
    op.drop_index('ix_push_tokens_center_account', table_name='push_tokens')
    op.drop_table('push_tokens')
