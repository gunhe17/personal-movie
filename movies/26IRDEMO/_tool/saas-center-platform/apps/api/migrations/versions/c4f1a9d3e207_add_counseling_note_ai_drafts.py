"""add counseling_note_ai_drafts

Revision ID: c4f1a9d3e207
Revises: b8d2f4a6c1e9
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c4f1a9d3e207'
down_revision: Union[str, Sequence[str], None] = 'b8d2f4a6c1e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": table}).scalar()


def upgrade() -> None:
    if _table_exists("counseling_note_ai_drafts"):
        return

    op.create_table(
        "counseling_note_ai_drafts",
        sa.Column("id", sa.String(length=36), nullable=False, comment="UUID Primary Key"),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False, comment="생성 시각 (UTC)"),
        sa.Column("updated_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False, comment="수정 시각 (UTC)"),
        sa.Column("deleted_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("center_id", sa.String(length=36), nullable=False),
        sa.Column("counseling_session_id", sa.String(length=36), nullable=False),
        sa.Column("field_note_id", sa.String(length=36), nullable=False),
        sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("summary", sa.String(length=1000), nullable=True),
        sa.Column("template_type", sa.String(length=50), nullable=False),
        sa.Column("llm_call_id", sa.String(length=36), nullable=True),
        sa.Column("author_id", sa.String(length=36), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_counseling_note_ai_drafts_center_id"), "counseling_note_ai_drafts", ["center_id"])
    op.create_index(op.f("ix_counseling_note_ai_drafts_counseling_session_id"), "counseling_note_ai_drafts", ["counseling_session_id"])
    op.create_index(op.f("ix_counseling_note_ai_drafts_field_note_id"), "counseling_note_ai_drafts", ["field_note_id"])
    op.create_index(op.f("ix_counseling_note_ai_drafts_llm_call_id"), "counseling_note_ai_drafts", ["llm_call_id"])
    op.create_index(op.f("ix_counseling_note_ai_drafts_author_id"), "counseling_note_ai_drafts", ["author_id"])
    op.create_index("idx_note_ai_draft_session", "counseling_note_ai_drafts", ["counseling_session_id"])
    op.create_index("idx_note_ai_draft_field_note", "counseling_note_ai_drafts", ["field_note_id"])


def downgrade() -> None:
    op.drop_table("counseling_note_ai_drafts")
