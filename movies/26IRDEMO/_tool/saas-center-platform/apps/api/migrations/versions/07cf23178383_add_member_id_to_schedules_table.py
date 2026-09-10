"""Add member_id to schedules table

Revision ID: 07cf23178383
Revises:
Create Date: 2026-02-02 21:29:43.988774

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '07cf23178383'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add member_id column to schedules table
    op.add_column('schedules', sa.Column('member_id', sa.String(length=36), nullable=True))

    # Create index for center_id + member_id
    op.create_index(
        op.f('ix_schedules_center_member'),
        'schedules',
        ['center_id', 'member_id'],
        unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop index
    op.drop_index(op.f('ix_schedules_center_member'), table_name='schedules')

    # Drop member_id column
    op.drop_column('schedules', 'member_id')
