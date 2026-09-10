"""merge_cancel_reason_and_pipeline_heads

Revision ID: 118a315fbbeb
Revises: a685618a4b17, c7e2a63f4ab3
Create Date: 2026-03-31 13:19:20.603594

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '118a315fbbeb'
down_revision: Union[str, Sequence[str], None] = ('a685618a4b17', 'c7e2a63f4ab3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
