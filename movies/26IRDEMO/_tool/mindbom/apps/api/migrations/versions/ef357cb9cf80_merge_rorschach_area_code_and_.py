"""merge rorschach area_code and notifications heads

Revision ID: ef357cb9cf80
Revises: 0124eb87b4a9, 8fd1440452c4
Create Date: 2026-04-28 17:13:22.423332

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ef357cb9cf80'
down_revision: Union[str, None] = ('0124eb87b4a9', '8fd1440452c4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
