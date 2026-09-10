"""merge voucher_documents and llm_calls_credit_snapshot

Revision ID: 2b277e784ffb
Revises: 925b7a4fbef3, d8e5b3a9c2f4
Create Date: 2026-05-20 20:09:03.667278

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b277e784ffb'
down_revision: Union[str, Sequence[str], None] = ('925b7a4fbef3', 'd8e5b3a9c2f4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
