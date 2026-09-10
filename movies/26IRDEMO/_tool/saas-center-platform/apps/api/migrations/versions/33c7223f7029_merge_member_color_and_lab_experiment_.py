"""merge_member_color_and_lab_experiment_heads

Revision ID: 33c7223f7029
Revises: 77bfa7d75a32, 9678e7dc97a2
Create Date: 2026-04-02 16:55:34.031783

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '33c7223f7029'
down_revision: Union[str, Sequence[str], None] = ('77bfa7d75a32', '9678e7dc97a2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
