"""cleanup conversation legacy fields + rename plan_vars to vars

- Drop v2 legacy columns: plan, turns, runtime_state
- Rename plan_vars → vars

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-26 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("agent_conversations", "plan")
    op.drop_column("agent_conversations", "turns")
    op.drop_column("agent_conversations", "runtime_state")
    op.alter_column("agent_conversations", "plan_vars", new_column_name="vars")


def downgrade() -> None:
    op.alter_column("agent_conversations", "vars", new_column_name="plan_vars")
    op.add_column("agent_conversations", sa.Column("runtime_state", JSONB, nullable=True))
    op.add_column("agent_conversations", sa.Column("turns", JSONB, nullable=True))
    op.add_column("agent_conversations", sa.Column("plan", JSONB, nullable=True))
