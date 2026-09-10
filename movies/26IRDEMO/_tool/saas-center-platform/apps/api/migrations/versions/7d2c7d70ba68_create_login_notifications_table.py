"""create_login_notifications_table

Revision ID: 7d2c7d70ba68
Revises: 442bd478b5c9
Create Date: 2026-02-03 10:31:06.443257

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7d2c7d70ba68'
down_revision: Union[str, Sequence[str], None] = '442bd478b5c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'login_notifications',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('account_id', sa.String(36), nullable=False),
        sa.Column('device_info', sa.String(500), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=False),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('login_at', sa.DateTime(timezone=False), nullable=False),
        sa.Column('is_new_device', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('notified_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('notification_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=False, server_default=sa.func.now()),
    )

    # Indexes for performance
    op.create_index('ix_login_notifications_account_id', 'login_notifications', ['account_id'])
    op.create_index('ix_login_notifications_login_at', 'login_notifications', ['login_at'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_login_notifications_login_at', 'login_notifications')
    op.drop_index('ix_login_notifications_account_id', 'login_notifications')
    op.drop_table('login_notifications')
