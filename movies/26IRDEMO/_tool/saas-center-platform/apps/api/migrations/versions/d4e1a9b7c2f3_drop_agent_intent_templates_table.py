"""drop agent_intent_templates table

신규 파이프라인은 reflex/intent_template을 사용하지 않으므로 테이블 제거.

Revision ID: d4e1a9b7c2f3
Revises: 2c89272dd309
Create Date: 2026-04-15 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = "d4e1a9b7c2f3"
down_revision: Union[str, None] = "2c89272dd309"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_intent_templates_center", table_name="agent_intent_templates")
    op.drop_index("ix_intent_templates_active", table_name="agent_intent_templates")
    op.drop_table("agent_intent_templates")


def downgrade() -> None:
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
