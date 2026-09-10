"""add form_sends table

Revision ID: b7f2a1c0d9e3
Revises: e2d7c4b9f1a8
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b7f2a1c0d9e3'
down_revision: Union[str, Sequence[str], None] = 'e2d7c4b9f1a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'form_sends',
        sa.Column('center_id', sa.String(length=36), nullable=False),
        sa.Column('form_template_id', sa.String(length=36), nullable=False),
        sa.Column('recipients', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('channel', sa.String(length=20), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_form_sends_center_id'), 'form_sends', ['center_id'], unique=False)
    op.create_index(op.f('ix_form_sends_form_template_id'), 'form_sends', ['form_template_id'], unique=False)
    op.create_index('ix_form_sends_center_template', 'form_sends', ['center_id', 'form_template_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_form_sends_center_template', table_name='form_sends')
    op.drop_index(op.f('ix_form_sends_form_template_id'), table_name='form_sends')
    op.drop_index(op.f('ix_form_sends_center_id'), table_name='form_sends')
    op.drop_table('form_sends')
