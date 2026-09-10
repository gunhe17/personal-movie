"""add notification_sent_at and invoice_issued template

Revision ID: 25d69e8bef48
Revises: eda194fde1b4
Create Date: 2026-04-14 10:41:51.226263

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '25d69e8bef48'
down_revision: Union[str, Sequence[str], None] = 'eda194fde1b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'billables',
        sa.Column(
            'notification_sent_at',
            sa.DateTime(timezone=False),
            nullable=True,
            comment='발행 알림 발송 시각 (UTC)',
        ),
    )


def downgrade() -> None:
    op.drop_column('billables', 'notification_sent_at')
