"""fix_counseling_notes_timestamp_defaults

Revision ID: 7fad8501fb48
Revises: 3fa4c1fc0511
Create Date: 2026-03-30 16:20:51.149215

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7fad8501fb48'
down_revision: Union[str, Sequence[str], None] = '3fa4c1fc0511'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """counseling_notes 테이블의 created_at/updated_at에 server_default 추가"""
    op.alter_column('counseling_notes', 'created_at',
               existing_type=sa.DateTime(),
               server_default=sa.text('now()'),
               existing_nullable=False)
    op.alter_column('counseling_notes', 'updated_at',
               existing_type=sa.DateTime(),
               server_default=sa.text('now()'),
               existing_nullable=False)


def downgrade() -> None:
    """server_default 제거"""
    op.alter_column('counseling_notes', 'updated_at',
               existing_type=sa.DateTime(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('counseling_notes', 'created_at',
               existing_type=sa.DateTime(),
               server_default=None,
               existing_nullable=False)
