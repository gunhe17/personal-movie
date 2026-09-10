"""add step status columns to field_notes

Revision ID: 33f28dbfcfae
Revises: a3e7c1d92f48
Create Date: 2026-04-08 11:59:34.698773

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '33f28dbfcfae'
down_revision: Union[str, Sequence[str], None] = 'a3e7c1d92f48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy.engine.reflection import Inspector
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing = {col['name'] for col in inspector.get_columns('field_notes')}

    if 'transcribe_status' not in existing:
        op.add_column('field_notes', sa.Column('transcribe_status', sa.String(length=20), server_default='pending', nullable=False, comment='전사 상태 (pending, processing, completed, failed)'))
    if 'refine_status' not in existing:
        op.add_column('field_notes', sa.Column('refine_status', sa.String(length=20), server_default='none', nullable=False, comment='보정 상태 (none, processing, completed, failed)'))
    if 'note_status' not in existing:
        op.add_column('field_notes', sa.Column('note_status', sa.String(length=20), server_default='none', nullable=False, comment='상담일지 상태 (none, processing, completed, failed)'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('field_notes', 'note_status')
    op.drop_column('field_notes', 'refine_status')
    op.drop_column('field_notes', 'transcribe_status')
