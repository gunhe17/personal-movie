"""merge field_note/client_image and form_sends/voucher_resources heads

Revision ID: b55c9595f707
Revises: a1c4e7d2b9f0, d4e8b2a6c1f7
Create Date: 2026-06-17 13:39:53.252338

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b55c9595f707'
down_revision: Union[str, Sequence[str], None] = ('a1c4e7d2b9f0', 'd4e8b2a6c1f7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
