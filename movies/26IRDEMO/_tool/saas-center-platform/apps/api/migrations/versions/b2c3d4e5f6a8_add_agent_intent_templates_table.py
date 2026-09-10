"""add agent_intent_templates table

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-03-27 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_intent_templates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("center_id", sa.String(36), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding_vector", JSONB, nullable=True),
        sa.Column("tool_config", JSONB, nullable=True),
        sa.Column("response_template", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_intent_templates_active", "agent_intent_templates", ["is_active"])
    op.create_index("ix_intent_templates_center", "agent_intent_templates", ["center_id", "is_active"])


def downgrade() -> None:
    op.drop_index("ix_intent_templates_center", table_name="agent_intent_templates")
    op.drop_index("ix_intent_templates_active", table_name="agent_intent_templates")
    op.drop_table("agent_intent_templates")
