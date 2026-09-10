"""add event_type to notification_settings

Revision ID: 220c784ce409
Revises: f7a4b9c1d3e5
Create Date: 2026-03-10 13:41:37.785733

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '220c784ce409'
down_revision: Union[str, Sequence[str], None] = 'f7a4b9c1d3e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column}).scalar()


def _index_exists(name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :i)"
    ), {"i": name}).scalar()


def upgrade() -> None:
    """Upgrade schema."""
    # 1. event_type 컬럼 추가 (nullable — 기존 데이터 영향 없음)
    if not _column_exists('notification_settings', 'event_type'):
        op.add_column(
            'notification_settings',
            sa.Column('event_type', sa.String(length=50), nullable=True,
                      comment='이벤트 세부 타입 (NULL = 카테고리 전체 설정)'),
        )

    # 2. 기존 unique index 삭제
    if _index_exists('ix_notification_settings_account'):
        op.drop_index(
            op.f('ix_notification_settings_account'),
            table_name='notification_settings',
        )

    # 3. 새 partial unique index 생성
    if not _index_exists('ix_noti_settings_category_only'):
        op.create_index(
            'ix_noti_settings_category_only',
            'notification_settings',
            ['center_id', 'account_id', 'category'],
            unique=True,
            postgresql_where=sa.text('event_type IS NULL'),
        )
    if not _index_exists('ix_noti_settings_event_type'):
        op.create_index(
            'ix_noti_settings_event_type',
            'notification_settings',
            ['center_id', 'account_id', 'category', 'event_type'],
            unique=True,
            postgresql_where=sa.text('event_type IS NOT NULL'),
        )


def downgrade() -> None:
    """Downgrade schema."""
    # 1. 새 partial index 삭제
    op.drop_index(
        'ix_noti_settings_event_type',
        table_name='notification_settings',
        postgresql_where=sa.text('event_type IS NOT NULL'),
    )
    op.drop_index(
        'ix_noti_settings_category_only',
        table_name='notification_settings',
        postgresql_where=sa.text('event_type IS NULL'),
    )

    # 2. 기존 unique index 복원
    op.create_index(
        op.f('ix_notification_settings_account'),
        'notification_settings',
        ['center_id', 'account_id', 'category'],
        unique=True,
    )

    # 3. event_type 컬럼 삭제
    op.drop_column('notification_settings', 'event_type')
