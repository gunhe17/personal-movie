"""refactor agent_messages and agent_runs fields

- agent_runs: add llm_call_id, drop turn/agent_type/input/output
- agent_messages: drop run_id/tool_calls/tool_result/llm_call_ids

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a8
Create Date: 2026-03-26 15:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # agent_runs: add llm_call_id
    op.add_column("agent_runs", sa.Column("llm_call_id", sa.String(36), nullable=True))
    op.create_index("ix_agent_runs_llm_call_id", "agent_runs", ["llm_call_id"])

    # agent_runs: drop legacy columns
    op.drop_column("agent_runs", "turn")
    op.drop_column("agent_runs", "agent_type")
    op.drop_column("agent_runs", "input")
    op.drop_column("agent_runs", "output")

    # agent_messages: drop legacy columns
    op.drop_column("agent_messages", "run_id")
    op.drop_column("agent_messages", "tool_calls")
    op.drop_column("agent_messages", "tool_result")
    op.drop_column("agent_messages", "llm_call_ids")


def downgrade() -> None:
    # agent_messages: restore
    op.add_column("agent_messages", sa.Column("llm_call_ids", JSONB, nullable=True))
    op.add_column("agent_messages", sa.Column("tool_result", JSONB, nullable=True))
    op.add_column("agent_messages", sa.Column("tool_calls", JSONB, nullable=True))
    op.add_column("agent_messages", sa.Column("run_id", sa.String(36), nullable=True))

    # agent_runs: restore
    op.add_column("agent_runs", sa.Column("output", sa.Text(), nullable=True))
    op.add_column("agent_runs", sa.Column("input", sa.Text(), nullable=True))
    op.add_column("agent_runs", sa.Column("agent_type", sa.String(50), nullable=True))
    op.add_column("agent_runs", sa.Column("turn", sa.Integer(), nullable=False, server_default="0"))

    # agent_runs: drop llm_call_id
    op.drop_index("ix_agent_runs_llm_call_id", table_name="agent_runs")
    op.drop_column("agent_runs", "llm_call_id")
