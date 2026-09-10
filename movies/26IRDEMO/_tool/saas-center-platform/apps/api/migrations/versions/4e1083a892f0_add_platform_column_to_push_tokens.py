"""add platform column to push_tokens

Revision ID: 4e1083a892f0
Revises: 6b36466141ef
Create Date: 2026-03-13 14:57:10.019767

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e1083a892f0'
down_revision: Union[str, Sequence[str], None] = '6b36466141ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('push_tokens', sa.Column('platform', sa.String(length=10), nullable=False, server_default='web', comment='플랫폼 (web, ios, android)'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('push_tokens', 'platform')
