"""notifications table

Revision ID: 8fd1440452c4
Revises: 2d67c3832d3e
Create Date: 2026-04-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8fd1440452c4"
down_revision: Union[str, None] = "2d67c3832d3e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("institution_id", sa.String(length=36), nullable=False),
        sa.Column("recipient_member_id", sa.String(length=36), nullable=False),
        sa.Column("type", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.String(length=50), nullable=True),
        sa.Column("entity_id", sa.String(length=36), nullable=True),
        sa.Column("link_path", sa.String(length=500), nullable=True),
        sa.Column("actor_member_id", sa.String(length=36), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=False), nullable=True),
    )
    op.create_index(
        op.f("ix_notifications_institution_id"),
        "notifications", ["institution_id"], unique=False,
    )
    op.create_index(
        op.f("ix_notifications_recipient_member_id"),
        "notifications", ["recipient_member_id"], unique=False,
    )
    op.create_index(
        op.f("ix_notifications_type"),
        "notifications", ["type"], unique=False,
    )
    op.create_index(
        "ix_notif_recipient_created",
        "notifications", ["recipient_member_id", "created_at"], unique=False,
    )
    op.create_index(
        "ix_notif_recipient_unread",
        "notifications", ["recipient_member_id", "read_at"], unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_notif_recipient_unread", table_name="notifications")
    op.drop_index("ix_notif_recipient_created", table_name="notifications")
    op.drop_index(op.f("ix_notifications_type"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_recipient_member_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_institution_id"), table_name="notifications")
    op.drop_table("notifications")
