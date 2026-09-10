"""add password_reset_tokens table

Revision ID: 9e986be62936
Revises: ef357cb9cf80
Create Date: 2026-04-29 11:12:24.205364

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e986be62936'
down_revision: Union[str, None] = 'ef357cb9cf80'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.Column('account_id', sa.String(length=36), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_password_reset_tokens_account_id'),
        'password_reset_tokens', ['account_id'], unique=False,
    )
    op.create_index(
        op.f('ix_password_reset_tokens_token_hash'),
        'password_reset_tokens', ['token_hash'], unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_password_reset_tokens_token_hash'),
        table_name='password_reset_tokens',
    )
    op.drop_index(
        op.f('ix_password_reset_tokens_account_id'),
        table_name='password_reset_tokens',
    )
    op.drop_table('password_reset_tokens')
