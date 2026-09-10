"""add_account_token_version

Revision ID: 1a0bd55e0260
Revises: 30f11365703a
Create Date: 2026-02-03 10:09:50.508067

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a0bd55e0260'
down_revision: Union[str, Sequence[str], None] = '30f11365703a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add token_version to accounts for JWT invalidation."""
    op.add_column(
        'accounts',
        sa.Column(
            'token_version',
            sa.Integer(),
            nullable=False,
            server_default='0',
            comment='JWT 버전 (권한 변경 시 증가, 즉시 로그아웃)'
        )
    )


def downgrade() -> None:
    """Remove token_version from accounts."""
    op.drop_column('accounts', 'token_version')
