"""add_status_to_members

Revision ID: a4e9e78a8287
Revises: 49e748b2712a
Create Date: 2026-02-25 14:50:58.317375

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4e9e78a8287'
down_revision: Union[str, Sequence[str], None] = 'ae06b6717c29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 기존 레코드를 위해 server_default 설정 후 제거
    op.add_column(
        'members',
        sa.Column(
            'status',
            sa.String(length=20),
            nullable=False,
            server_default='active',
            comment='상태 (active, inactive)',
        ),
    )
    op.alter_column('members', 'status', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('members', 'status')
