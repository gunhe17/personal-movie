"""add counseling_note_derivations

Revision ID: 4629c1fe0a2a
Revises: c4f1a9d3e207
Create Date: 2026-07-21 10:51:52.398708

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '4629c1fe0a2a'
down_revision: Union[str, Sequence[str], None] = 'c4f1a9d3e207'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": table}).scalar()


def upgrade() -> None:
    if _table_exists("counseling_note_derivations"):
        return

    op.create_table(
        "counseling_note_derivations",
        sa.Column("id", sa.String(length=36), nullable=False, comment="UUID Primary Key"),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False, comment="생성 시각 (UTC)"),
        sa.Column("updated_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False, comment="수정 시각 (UTC)"),
        sa.Column("deleted_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("center_id", sa.String(length=36), nullable=False),
        sa.Column("counseling_note_id", sa.String(length=36), nullable=False),
        sa.Column("counseling_session_id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("generated_content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("published_by", sa.String(length=36), nullable=True),
        sa.Column("llm_call_id", sa.String(length=36), nullable=True),
        sa.Column("author_id", sa.String(length=36), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_counseling_note_derivations_center_id"), "counseling_note_derivations", ["center_id"])
    op.create_index(op.f("ix_counseling_note_derivations_counseling_note_id"), "counseling_note_derivations", ["counseling_note_id"])
    op.create_index(op.f("ix_counseling_note_derivations_counseling_session_id"), "counseling_note_derivations", ["counseling_session_id"])
    op.create_index(op.f("ix_counseling_note_derivations_client_id"), "counseling_note_derivations", ["client_id"])
    op.create_index(op.f("ix_counseling_note_derivations_llm_call_id"), "counseling_note_derivations", ["llm_call_id"])
    op.create_index(op.f("ix_counseling_note_derivations_author_id"), "counseling_note_derivations", ["author_id"])
    op.create_index("idx_note_derivation_note", "counseling_note_derivations", ["counseling_note_id"])
    op.create_index("idx_note_derivation_session", "counseling_note_derivations", ["counseling_session_id"])
    op.create_index(
        "uq_note_derivation_published",
        "counseling_note_derivations",
        ["counseling_note_id", "kind"],
        unique=True,
        postgresql_where=sa.text("status = 'published' AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_table("counseling_note_derivations")
