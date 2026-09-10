"""add note_template_type and center_note_preferences

Revision ID: 1be795345590
Revises: 2c89272dd309
Create Date: 2026-04-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '1be795345590'
down_revision: Union[str, Sequence[str], None] = '2c89272dd309'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. FieldNote에 note_template_type 컬럼 추가
    op.add_column(
        'field_notes',
        sa.Column(
            'note_template_type',
            sa.String(length=30),
            nullable=True,
            comment='노트 서식 타입 (default, soap, dap, birp, family_center)',
        ),
    )

    # 2. center_note_preferences 테이블 생성
    op.create_table(
        'center_note_preferences',
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID (UUID)'),
        sa.Column(
            'default_template_type',
            sa.String(length=30),
            nullable=False,
            server_default='default',
            comment='기본 노트 서식 (default, soap, dap, birp, family_center)',
        ),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('center_id', name='uq_center_note_pref_center'),
    )
    op.create_index('ix_center_note_preferences_center_id', 'center_note_preferences', ['center_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_center_note_preferences_center_id', table_name='center_note_preferences')
    op.drop_table('center_note_preferences')
    op.drop_column('field_notes', 'note_template_type')
