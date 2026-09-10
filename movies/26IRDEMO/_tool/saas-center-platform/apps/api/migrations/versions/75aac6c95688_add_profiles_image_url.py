"""profiles 아바타 컬럼 추가

Revision ID: 75aac6c95688
Revises: 5b0e395f5b1e
Create Date: 2026-08-26 14:18:02.582405

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '75aac6c95688'
down_revision: Union[str, Sequence[str], None] = '5b0e395f5b1e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column}).scalar()


def upgrade() -> None:
    """Upgrade schema."""
    if not _column_exists('profiles', 'image_url'):
        op.add_column(
            'profiles',
            sa.Column('image_url', sa.String(length=500), nullable=True),
        )


def downgrade() -> None:
    """Downgrade schema."""
    if _column_exists('profiles', 'image_url'):
        op.drop_column('profiles', 'image_url')
