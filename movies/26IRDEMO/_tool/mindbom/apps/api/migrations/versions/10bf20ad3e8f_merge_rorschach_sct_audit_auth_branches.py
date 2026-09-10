"""merge rorschach + sct/audit/auth branches

Revision ID: 10bf20ad3e8f
Revises: 4acc6ede2e06, 61a24c5d67bb
Create Date: 2026-04-27 17:08:57.481179

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '10bf20ad3e8f'
down_revision: Union[str, None] = ('4acc6ede2e06', '61a24c5d67bb')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
