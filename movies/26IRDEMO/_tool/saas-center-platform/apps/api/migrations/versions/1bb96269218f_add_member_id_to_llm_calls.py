"""add_member_id_to_llm_calls

Revision ID: 1bb96269218f
Revises: 09ce267d0a7d
Create Date: 2026-05-21 10:51:04.930701

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '1bb96269218f'
down_revision: Union[str, Sequence[str], None] = '09ce267d0a7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('llm_calls', sa.Column('member_id', sa.String(length=36), nullable=True))
    op.create_index(op.f('ix_llm_calls_member_id'), 'llm_calls', ['member_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_llm_calls_member_id'), table_name='llm_calls')
    op.drop_column('llm_calls', 'member_id')
