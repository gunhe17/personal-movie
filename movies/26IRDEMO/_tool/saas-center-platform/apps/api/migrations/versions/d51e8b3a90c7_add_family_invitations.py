"""add family_invitations

Revision ID: d51e8b3a90c7
Revises: 4629c1fe0a2a
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'd51e8b3a90c7'
down_revision: Union[str, Sequence[str], None] = '4629c1fe0a2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": table}).scalar()


def upgrade() -> None:
    if _table_exists("family_invitations"):
        return

    op.create_table(
        "family_invitations",
        sa.Column("id", sa.String(length=36), nullable=False, comment="UUID Primary Key"),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False, comment="생성 시각 (UTC)"),
        sa.Column("updated_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False, comment="수정 시각 (UTC)"),
        sa.Column("deleted_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("family_id", sa.String(length=36), nullable=False),
        sa.Column("code", sa.String(length=6), nullable=False),
        sa.Column("invited_by_person_id", sa.String(length=36), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("claimed_by_person_id", sa.String(length=36), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_family_invitations_family_id", "family_invitations", ["family_id"])
    op.create_index("ix_family_invitations_code", "family_invitations", ["code"])


def downgrade() -> None:
    op.drop_index("ix_family_invitations_code", table_name="family_invitations")
    op.drop_index("ix_family_invitations_family_id", table_name="family_invitations")
    op.drop_table("family_invitations")
