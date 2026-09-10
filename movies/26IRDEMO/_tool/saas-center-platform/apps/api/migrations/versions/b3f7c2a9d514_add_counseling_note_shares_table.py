"""add counseling_note_shares table

상담 일지 → 보호자·본인용 공유문 (발행분만 내담자 앱 노출)

Revision ID: b3f7c2a9d514
Revises: 75aac6c95688
Create Date: 2026-08-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql


revision: str = 'b3f7c2a9d514'
down_revision: Union[str, Sequence[str], None] = '75aac6c95688'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": name}).scalar()


def _index_exists(name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :i)"
    ), {"i": name}).scalar()


def upgrade() -> None:
    if not _table_exists('counseling_note_shares'):
        op.create_table(
            'counseling_note_shares',
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('center_id', sa.String(length=36), nullable=False),
            sa.Column('counseling_session_id', sa.String(length=36), nullable=False),
            sa.Column('client_id', sa.String(length=36), nullable=False),
            sa.Column('counseling_note_id', sa.String(length=36), nullable=True),
            sa.Column('author_id', sa.String(length=36), nullable=False),
            sa.Column('llm_call_id', sa.String(length=36), nullable=True),
            sa.Column('audience', sa.String(length=20), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column('is_edited', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('published_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )
    for index_name, columns in (
        ('ix_counseling_note_shares_center_id', ['center_id']),
        ('ix_counseling_note_shares_counseling_session_id', ['counseling_session_id']),
        ('ix_counseling_note_shares_client_id', ['client_id']),
        ('ix_counseling_note_shares_counseling_note_id', ['counseling_note_id']),
        ('ix_counseling_note_shares_author_id', ['author_id']),
        ('ix_counseling_note_shares_llm_call_id', ['llm_call_id']),
        ('ix_counseling_note_shares_status', ['status']),
        ('idx_note_share_session', ['counseling_session_id']),
        ('idx_note_share_client', ['client_id']),
    ):
        if not _index_exists(index_name):
            op.create_index(index_name, 'counseling_note_shares', columns)

    if not _index_exists('uq_note_share_session_client'):
        op.create_index(
            'uq_note_share_session_client',
            'counseling_note_shares',
            ['counseling_session_id', 'client_id'],
            unique=True,
            postgresql_where=sa.text('deleted_at IS NULL'),
        )


def downgrade() -> None:
    op.drop_index('uq_note_share_session_client', table_name='counseling_note_shares')
    op.drop_table('counseling_note_shares')
