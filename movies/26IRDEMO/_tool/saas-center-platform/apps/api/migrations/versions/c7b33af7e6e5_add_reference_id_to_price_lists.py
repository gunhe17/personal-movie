"""add reference_id to price_lists

Revision ID: c7b33af7e6e5
Revises: a5b2e8c1d4f7
Create Date: 2026-04-13 11:05:09.048953

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7b33af7e6e5'
down_revision: Union[str, Sequence[str], None] = 'a5b2e8c1d4f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('price_lists', sa.Column('reference_id', sa.String(length=36), nullable=True, comment='연관 리소스 ID (검사/상담/세트 — 단가 매칭용 레퍼런스)'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('price_lists', 'reference_id')
