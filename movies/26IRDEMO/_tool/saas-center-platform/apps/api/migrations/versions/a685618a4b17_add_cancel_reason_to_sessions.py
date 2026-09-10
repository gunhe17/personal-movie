"""add_cancel_reason_to_sessions

Revision ID: a685618a4b17
Revises: 3c0a48bd95a0
Create Date: 2026-03-31 09:29:59.731225

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a685618a4b17'
down_revision: Union[str, Sequence[str], None] = '3c0a48bd95a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('assessment_sessions', sa.Column('cancel_reason', sa.String(length=500), nullable=True, comment='취소 사유'))
    op.add_column('counseling_sessions', sa.Column('cancel_reason', sa.String(length=500), nullable=True, comment='취소 사유'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('counseling_sessions', 'cancel_reason')
    op.drop_column('assessment_sessions', 'cancel_reason')
