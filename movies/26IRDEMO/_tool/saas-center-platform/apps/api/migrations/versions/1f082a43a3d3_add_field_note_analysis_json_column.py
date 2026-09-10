"""add field_note analysis json column

Revision ID: 1f082a43a3d3
Revises: 65937121dd69
Create Date: 2026-06-04 23:18:02.815598

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1f082a43a3d3'
down_revision: Union[str, Sequence[str], None] = '65937121dd69'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "field_notes",
        sa.Column(
            "analysis",
            sa.Text(),
            nullable=True,
            comment="AI 구조화 분석 결과 (JSON)",
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("field_notes", "analysis")
