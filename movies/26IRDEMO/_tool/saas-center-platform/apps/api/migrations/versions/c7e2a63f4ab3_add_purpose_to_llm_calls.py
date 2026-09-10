"""add_purpose_to_llm_calls

Revision ID: c7e2a63f4ab3
Revises: 99d4d59db373
Create Date: 2026-03-31 10:09:06.369524

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c7e2a63f4ab3'
down_revision: Union[str, Sequence[str], None] = '99d4d59db373'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('llm_calls', sa.Column('purpose', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_llm_calls_purpose'), 'llm_calls', ['purpose'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_llm_calls_purpose'), table_name='llm_calls')
    op.drop_column('llm_calls', 'purpose')
