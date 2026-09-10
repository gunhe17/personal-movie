"""add related_type and related_case_id to billable_items

Revision ID: a5b2e8c1d4f7
Revises: 1184902167e4
Create Date: 2026-04-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a5b2e8c1d4f7'
down_revision: Union[str, Sequence[str], None] = 'ab9b2fcae028'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'billable_items',
        sa.Column(
            'related_type',
            sa.String(length=50),
            nullable=True,
            comment='연관 유형: counseling_session, assessment_session',
        ),
    )
    op.add_column(
        'billable_items',
        sa.Column(
            'related_case_id',
            sa.String(length=36),
            nullable=True,
            comment='연관 케이스 ID (상담/검사 케이스)',
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('billable_items', 'related_case_id')
    op.drop_column('billable_items', 'related_type')
