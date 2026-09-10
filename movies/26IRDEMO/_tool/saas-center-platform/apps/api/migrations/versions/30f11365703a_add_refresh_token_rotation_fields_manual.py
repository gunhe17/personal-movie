"""add_refresh_token_rotation_fields_manual

Revision ID: 30f11365703a
Revises: 07cf23178383
Create Date: 2026-02-02 22:53:05.334639

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '30f11365703a'
down_revision: Union[str, Sequence[str], None] = '07cf23178383'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add used_at and parent_token_id to refresh_tokens for token rotation."""
    # Add used_at column for one-time use detection
    op.add_column(
        'refresh_tokens',
        sa.Column(
            'used_at',
            sa.DateTime(timezone=False),
            nullable=True,
            comment='토큰 사용 시각 (일회용 검증)'
        )
    )

    # Add parent_token_id column for token family tracking
    op.add_column(
        'refresh_tokens',
        sa.Column(
            'parent_token_id',
            sa.String(36),
            nullable=True,
            comment='이전 토큰 ID (토큰 패밀리 추적)'
        )
    )


def downgrade() -> None:
    """Remove used_at and parent_token_id from refresh_tokens."""
    op.drop_column('refresh_tokens', 'parent_token_id')
    op.drop_column('refresh_tokens', 'used_at')
