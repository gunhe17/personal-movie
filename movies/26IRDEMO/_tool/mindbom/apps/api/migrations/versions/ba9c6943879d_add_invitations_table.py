"""add invitations table

Revision ID: ba9c6943879d
Revises: 9e986be62936
Create Date: 2026-04-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ba9c6943879d'
down_revision: Union[str, None] = '9e986be62936'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'invitations',
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.Column('institution_id', sa.String(length=36), nullable=False),
        sa.Column('email', sa.String(length=254), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('accepted_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('invited_by_account_id', sa.String(length=36), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_invitations_institution_id'),
        'invitations', ['institution_id'], unique=False,
    )
    op.create_index(
        op.f('ix_invitations_email'),
        'invitations', ['email'], unique=False,
    )
    op.create_index(
        op.f('ix_invitations_token_hash'),
        'invitations', ['token_hash'], unique=True,
    )
    op.create_index(
        op.f('ix_invitations_invited_by_account_id'),
        'invitations', ['invited_by_account_id'], unique=False,
    )
    # 복합 인덱스: 기관 내 pending 검색 (재초대 lookup, 초대 현황 탭 조회)
    op.create_index(
        'ix_invitations_institution_status',
        'invitations', ['institution_id', 'status'], unique=False,
    )
    op.create_index(
        'ix_invitations_institution_email_status',
        'invitations', ['institution_id', 'email', 'status'], unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_invitations_institution_email_status', table_name='invitations')
    op.drop_index('ix_invitations_institution_status', table_name='invitations')
    op.drop_index(op.f('ix_invitations_invited_by_account_id'), table_name='invitations')
    op.drop_index(op.f('ix_invitations_token_hash'), table_name='invitations')
    op.drop_index(op.f('ix_invitations_email'), table_name='invitations')
    op.drop_index(op.f('ix_invitations_institution_id'), table_name='invitations')
    op.drop_table('invitations')
