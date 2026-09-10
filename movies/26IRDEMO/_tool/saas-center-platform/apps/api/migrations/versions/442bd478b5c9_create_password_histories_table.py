"""create_password_histories_table

Revision ID: 442bd478b5c9
Revises: a0571f99b8e6
Create Date: 2026-02-03 10:15:59.932876

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '442bd478b5c9'
down_revision: Union[str, Sequence[str], None] = 'a0571f99b8e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create password_histories table for password reuse prevention."""
    op.create_table(
        'password_histories',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('account_id', sa.String(36), nullable=False, comment='연결된 Account UUID'),
        sa.Column('password', sa.String(255), nullable=False, comment='이전 비밀번호 해시'),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=False, comment='수정 시각 (UTC)'),
    )

    # 인덱스 생성 (account_id + created_at 정렬)
    op.create_index(
        'ix_password_histories_account_created',
        'password_histories',
        ['account_id', 'created_at']
    )


def downgrade() -> None:
    """Drop password_histories table."""
    op.drop_index('ix_password_histories_account_created', table_name='password_histories')
    op.drop_table('password_histories')
