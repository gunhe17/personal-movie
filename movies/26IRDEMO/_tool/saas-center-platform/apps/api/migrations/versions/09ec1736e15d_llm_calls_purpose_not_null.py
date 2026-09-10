"""llm_calls purpose not null

Revision ID: 09ec1736e15d
Revises: 90d41b50a0b5
Create Date: 2026-05-07 10:43:48.349723

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '09ec1736e15d'
down_revision: Union[str, Sequence[str], None] = '90d41b50a0b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """llm_calls.purpose: nullable → NOT NULL.

    1. 기존 NULL 행을 'unknown'으로 채움
    2. NOT NULL 제약 적용
    """
    op.execute("UPDATE llm_calls SET purpose = 'unknown' WHERE purpose IS NULL")
    op.alter_column(
        "llm_calls",
        "purpose",
        existing_type=sa.String(50),
        nullable=False,
    )


def downgrade() -> None:
    """Revert: purpose를 다시 nullable로."""
    op.alter_column(
        "llm_calls",
        "purpose",
        existing_type=sa.String(50),
        nullable=True,
    )
