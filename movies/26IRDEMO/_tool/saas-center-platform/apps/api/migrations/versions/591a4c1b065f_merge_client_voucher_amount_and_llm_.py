"""merge client_voucher_amount and llm_calls_member_id heads

Revision ID: 591a4c1b065f
Revises: 812d1780e726, b5aa0037412f
Create Date: 2026-05-22 13:05:14.614329

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '591a4c1b065f'
down_revision: Union[str, Sequence[str], None] = ('812d1780e726', 'b5aa0037412f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
