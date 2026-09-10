"""add source column to price_lists

Revision ID: fcdae1c39850
Revises: 882ac70ea637
Create Date: 2026-04-10 10:53:51.540229

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'fcdae1c39850'
down_revision: Union[str, Sequence[str], None] = '882ac70ea637'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'price_lists',
        sa.Column(
            'source',
            sa.String(length=20),
            server_default='manual',
            nullable=False,
            comment='등록 출처: manual, synced',
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('price_lists', 'source')
