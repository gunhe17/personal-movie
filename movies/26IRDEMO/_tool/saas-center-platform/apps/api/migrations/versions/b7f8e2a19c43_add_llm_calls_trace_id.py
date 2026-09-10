"""add llm_calls trace_id column

Revision ID: b7f8e2a19c43
Revises: 09ec1736e15d
Create Date: 2026-05-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7f8e2a19c43"
down_revision: Union[str, Sequence[str], None] = "09ec1736e15d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """llm_calls에 trace_id 컬럼 추가 (Worker 추적용)."""
    op.add_column(
        "llm_calls",
        sa.Column("trace_id", sa.String(36), nullable=True),
    )
    op.create_index("ix_llm_calls_trace_id", "llm_calls", ["trace_id"])


def downgrade() -> None:
    """trace_id 컬럼 제거."""
    op.drop_index("ix_llm_calls_trace_id", table_name="llm_calls")
    op.drop_column("llm_calls", "trace_id")
