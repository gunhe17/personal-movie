"""add v3 pipeline columns to agent tables

Revision ID: a1b2c3d4e5f7
Revises: c1a2b3d4e5f6
Create Date: 2026-03-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "c1a2b3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── agent_conversations: v3 Pipeline 컬럼 추가 ──
    op.add_column(
        "agent_conversations",
        sa.Column("display_plan", JSONB, nullable=True),
    )
    op.add_column(
        "agent_conversations",
        sa.Column("plan_vars", JSONB, nullable=True),
    )

    # ── agent_messages: v3 Pipeline 컬럼 추가 ──
    # conversation_id 추가 (v3에서는 conversation 기반)
    op.add_column(
        "agent_messages",
        sa.Column("conversation_id", sa.String(36), nullable=True),
    )
    op.create_index(
        "ix_messages_conversation_seq",
        "agent_messages",
        ["conversation_id", "sequence"],
    )

    # display_message (UI rendering용 structured data)
    op.add_column(
        "agent_messages",
        sa.Column("display_message", JSONB, nullable=True),
    )

    # type (message | compaction)
    op.add_column(
        "agent_messages",
        sa.Column("type", sa.String(20), nullable=True),
    )

    # role 컬럼 길이 확장 (10 → 20, "compaction" 역할 수용)
    op.alter_column(
        "agent_messages",
        "role",
        existing_type=sa.String(10),
        type_=sa.String(20),
        existing_nullable=False,
    )

    # run_id를 nullable로 변경 (v3에서는 conversation_id 기반)
    op.alter_column(
        "agent_messages",
        "run_id",
        existing_type=sa.String(36),
        nullable=True,
    )

    # ── agent_runs: v3 Pipeline 컬럼 추가 ──
    # type (tool_call | llm_call)
    op.add_column(
        "agent_runs",
        sa.Column("type", sa.String(20), nullable=True),
    )

    # input_data, output_data (JSONB 구조화 입출력)
    op.add_column(
        "agent_runs",
        sa.Column("input_data", JSONB, nullable=True),
    )
    op.add_column(
        "agent_runs",
        sa.Column("output_data", JSONB, nullable=True),
    )

    # agent_type을 nullable로 변경 (v3에서는 type 사용)
    op.alter_column(
        "agent_runs",
        "agent_type",
        existing_type=sa.String(20),
        nullable=True,
    )


def downgrade() -> None:
    # ── agent_runs: 되돌리기 ──
    op.alter_column(
        "agent_runs",
        "agent_type",
        existing_type=sa.String(20),
        nullable=False,
    )
    op.drop_column("agent_runs", "output_data")
    op.drop_column("agent_runs", "input_data")
    op.drop_column("agent_runs", "type")

    # ── agent_messages: 되돌리기 ──
    op.alter_column(
        "agent_messages",
        "run_id",
        existing_type=sa.String(36),
        nullable=False,
    )
    op.alter_column(
        "agent_messages",
        "role",
        existing_type=sa.String(20),
        type_=sa.String(10),
        existing_nullable=False,
    )
    op.drop_column("agent_messages", "type")
    op.drop_column("agent_messages", "display_message")
    op.drop_index("ix_messages_conversation_seq", table_name="agent_messages")
    op.drop_column("agent_messages", "conversation_id")

    # ── agent_conversations: 되돌리기 ──
    op.drop_column("agent_conversations", "plan_vars")
    op.drop_column("agent_conversations", "display_plan")
