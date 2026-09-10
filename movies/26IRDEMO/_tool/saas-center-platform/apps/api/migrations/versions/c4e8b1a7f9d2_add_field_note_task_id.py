"""add field_note task_id (검사 항목별 필드노트 연결)

Revision ID: c4e8b1a7f9d2
Revises: 1f082a43a3d3
Create Date: 2026-06-05 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4e8b1a7f9d2'
down_revision: Union[str, Sequence[str], None] = '1f082a43a3d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "field_notes",
        sa.Column(
            "task_id",
            sa.String(length=36),
            nullable=True,
            comment="검사 Task ID (UUID, nullable - 검사 항목별 연결용, FK 제약 없음)",
        ),
    )
    op.create_index("idx_field_note_task", "field_notes", ["task_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_field_note_task", table_name="field_notes")
    op.drop_column("field_notes", "task_id")
