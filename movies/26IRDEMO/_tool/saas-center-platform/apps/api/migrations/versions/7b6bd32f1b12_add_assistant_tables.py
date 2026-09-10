"""add assistant tables

Revision ID: 7b6bd32f1b12
Revises: c5768f75e312
Create Date: 2026-07-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '7b6bd32f1b12'
down_revision: Union[str, Sequence[str], None] = 'c5768f75e312'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'assistant_conversations',
        sa.Column('center_id', sa.String(length=36), nullable=False),
        sa.Column('member_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_assistant_conversations_center_id', 'assistant_conversations', ['center_id'], unique=False
    )
    op.create_index(
        'ix_assistant_conversations_center_member',
        'assistant_conversations',
        ['center_id', 'member_id'],
        unique=False,
        postgresql_where='deleted_at IS NULL',
    )
    op.create_table(
        'assistant_turns',
        sa.Column('conversation_id', sa.String(length=36), nullable=False),
        sa.Column('center_id', sa.String(length=36), nullable=False),
        sa.Column('user_message', sa.Text(), nullable=False),
        sa.Column('events', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('completion', sa.Text(), nullable=True),
        sa.Column('bookmark', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_assistant_turns_center_id', 'assistant_turns', ['center_id'], unique=False
    )
    op.create_index(
        'ix_assistant_turns_conversation_created',
        'assistant_turns',
        ['conversation_id', 'created_at'],
        unique=False,
        postgresql_where='deleted_at IS NULL',
    )
    op.create_index(
        'ix_assistant_turns_center_status',
        'assistant_turns',
        ['center_id', 'status'],
        unique=False,
        postgresql_where='deleted_at IS NULL',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_assistant_turns_center_status', table_name='assistant_turns')
    op.drop_index('ix_assistant_turns_conversation_created', table_name='assistant_turns')
    op.drop_index('ix_assistant_turns_center_id', table_name='assistant_turns')
    op.drop_table('assistant_turns')
    op.drop_index('ix_assistant_conversations_center_member', table_name='assistant_conversations')
    op.drop_index('ix_assistant_conversations_center_id', table_name='assistant_conversations')
    op.drop_table('assistant_conversations')
