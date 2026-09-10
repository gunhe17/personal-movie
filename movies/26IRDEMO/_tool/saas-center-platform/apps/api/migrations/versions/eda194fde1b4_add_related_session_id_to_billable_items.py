"""add related_session_id to billable_items

Revision ID: eda194fde1b4
Revises: c7b33af7e6e5
Create Date: 2026-04-14 09:51:25.973324

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'eda194fde1b4'
down_revision: Union[str, Sequence[str], None] = 'c7b33af7e6e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'billable_items',
        sa.Column(
            'related_session_id',
            sa.String(length=36),
            nullable=True,
            comment='연관 세션 ID (회차별 청구 추적용)',
        ),
    )


def downgrade() -> None:
    op.drop_column('billable_items', 'related_session_id')
