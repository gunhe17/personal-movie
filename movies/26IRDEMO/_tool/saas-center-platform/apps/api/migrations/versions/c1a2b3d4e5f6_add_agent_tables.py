"""add agent tables (conversations, runs, messages, prompts, llm_calls)

Revision ID: c1a2b3d4e5f6
Revises: b7d8e9f01234
Create Date: 2026-03-19 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = "c1a2b3d4e5f6"
down_revision: Union[str, None] = "b7d8e9f01234"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── agent_conversations ──
    op.create_table(
        "agent_conversations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("center_id", sa.String(36), nullable=False),
        sa.Column("member_id", sa.String(36), nullable=False),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("plan", JSONB, nullable=True),
        sa.Column("turns", JSONB, nullable=True),
        sa.Column("runtime_state", JSONB, nullable=True),
        sa.Column("meta", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_conversations_center_updated", "agent_conversations", ["center_id", "updated_at"])
    op.create_index("ix_conversations_member", "agent_conversations", ["member_id"])

    # ── agent_runs ──
    op.create_table(
        "agent_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("conversation_id", sa.String(36), nullable=False),
        sa.Column("turn", sa.Integer(), nullable=False),
        sa.Column("agent_type", sa.String(20), nullable=False),
        sa.Column("agent_name", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("input", sa.Text(), nullable=True),
        sa.Column("output", sa.Text(), nullable=True),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("parallel_group", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_runs_conversation_seq", "agent_runs", ["conversation_id", "sequence"])
    op.create_index("ix_runs_conversation_turn", "agent_runs", ["conversation_id", "turn"])

    # ── agent_messages ──
    op.create_table(
        "agent_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_id", sa.String(36), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("tool_calls", JSONB, nullable=True),
        sa.Column("tool_result", JSONB, nullable=True),
        sa.Column("llm_call_ids", JSONB, nullable=True),
        sa.Column("sequence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_messages_run_seq", "agent_messages", ["run_id", "sequence"])

    # ── agent_prompts ──
    op.create_table(
        "agent_prompts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_unique_constraint("uq_agent_prompts_key_version", "agent_prompts", ["key", "version"])
    op.create_index("ix_agent_prompts_key_active", "agent_prompts", ["key", "is_active"])

    # ── llm_calls ──
    op.create_table(
        "llm_calls",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("meta", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_llm_calls_session_id", "llm_calls", ["session_id"])


def downgrade() -> None:
    op.drop_table("llm_calls")
    op.drop_table("agent_prompts")
    op.drop_table("agent_messages")
    op.drop_table("agent_runs")
    op.drop_table("agent_conversations")
