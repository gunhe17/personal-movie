"""app scoped push tokens and notification settings

Revision ID: e83b5c2f47a1
Revises: d51e8b3a90c7
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'e83b5c2f47a1'
down_revision: Union[str, Sequence[str], None] = 'd51e8b3a90c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _index_exists(name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :i)"
    ), {"i": name}).scalar()


def _is_nullable(table: str, column: str) -> bool:
    conn = op.get_bind()
    for col in sa.inspect(conn).get_columns(table):
        if col["name"] == column:
            return col["nullable"]
    return False


def upgrade() -> None:
    # center_id NULL = 계정 전역(내담자 앱). 기존 행은 전부 NOT NULL 값이라 영향 없음.
    if not _is_nullable("push_tokens", "center_id"):
        op.alter_column(
            "push_tokens", "center_id",
            existing_type=sa.String(length=36), nullable=True,
        )
    if not _is_nullable("notification_settings", "center_id"):
        op.alter_column(
            "notification_settings", "center_id",
            existing_type=sa.String(length=36), nullable=True,
        )

    if not _index_exists("ix_push_tokens_account"):
        op.create_index("ix_push_tokens_account", "push_tokens", ["account_id"])

    # 기존 partial unique는 center_id가 NULL이면 유일성을 못 지킨다(NULL끼리 서로 다름)
    if not _index_exists("uq_noti_settings_global_category"):
        op.create_index(
            "uq_noti_settings_global_category", "notification_settings",
            ["account_id", "category"], unique=True,
            postgresql_where=sa.text("center_id IS NULL AND event_type IS NULL"),
        )
    if not _index_exists("uq_noti_settings_global_event"):
        op.create_index(
            "uq_noti_settings_global_event", "notification_settings",
            ["account_id", "category", "event_type"], unique=True,
            postgresql_where=sa.text("center_id IS NULL AND event_type IS NOT NULL"),
        )

    # 앱 알림함은 센터를 가로질러 읽는다 — 기존 ix_notifications_recipient는 center_id 선두라 못 쓴다
    if not _index_exists("ix_notifications_recipient_only"):
        op.create_index(
            "ix_notifications_recipient_only", "notifications",
            ["recipient_id", "is_read", "created_at"],
        )


def downgrade() -> None:
    # NOT NULL 복원은 앱 행(center_id IS NULL)이 있으면 실패한다 — 인덱스만 되돌린다.
    # 이 리비전의 롤백은 스키마가 아니라 코드 롤백이어야 한다.
    for name in (
        "ix_notifications_recipient_only",
        "uq_noti_settings_global_event",
        "uq_noti_settings_global_category",
        "ix_push_tokens_account",
    ):
        if _index_exists(name):
            op.drop_index(name)
