"""add schedule change requests

Revision ID: a7c31d94e5b2
Revises: e83b5c2f47a1
Create Date: 2026-07-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'a7c31d94e5b2'
down_revision: Union[str, Sequence[str], None] = 'e83b5c2f47a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    return sa.inspect(conn).has_table(name)


def upgrade() -> None:
    if _table_exists("schedule_change_requests"):
        return

    op.create_table(
        "schedule_change_requests",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("center_id", sa.String(length=36), nullable=False),
        sa.Column("schedule_id", sa.String(length=36), nullable=False),
        sa.Column("person_id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("current_start", sa.DateTime(), nullable=False),
        sa.Column("current_end", sa.DateTime(), nullable=False),
        sa.Column("requested_start", sa.DateTime(), nullable=False),
        sa.Column("requested_end", sa.DateTime(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("decided_by_member_id", sa.String(length=36), nullable=True),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_schedule_change_requests_center_id", "schedule_change_requests", ["center_id"])
    op.create_index("ix_schedule_change_requests_schedule_id", "schedule_change_requests", ["schedule_id"])
    op.create_index("ix_schedule_change_requests_person_id", "schedule_change_requests", ["person_id"])
    op.create_index("ix_schedule_change_requests_client_id", "schedule_change_requests", ["client_id"])
    op.create_index("ix_schedule_change_requests_status", "schedule_change_requests", ["status"])
    op.create_index(
        "ix_schedule_change_requests_center_status",
        "schedule_change_requests",
        ["center_id", "status"],
    )
    # 한 일정에 대기 중 요청은 하나만 — 반려·승인된 과거 요청은 남기고 재요청은 허용
    op.create_index(
        "uq_schedule_change_request_pending",
        "schedule_change_requests",
        ["schedule_id"],
        unique=True,
        postgresql_where=text("status = 'pending' AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_table("schedule_change_requests")
