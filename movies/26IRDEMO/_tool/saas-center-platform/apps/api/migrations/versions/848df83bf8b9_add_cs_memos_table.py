"""add cs_memos table

Revision ID: 848df83bf8b9
Revises: 6d96161b50e4
Create Date: 2026-03-18 11:55:57.142941

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '848df83bf8b9'
down_revision: Union[str, Sequence[str], None] = '6d96161b50e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    """테이블 존재 여부 확인 (이미 수동 생성된 경우 대응)"""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :t)"
        ),
        {"t": table_name},
    )
    return result.scalar()


def _index_exists(index_name: str) -> bool:
    """인덱스 존재 여부 확인"""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pg_indexes "
            "WHERE indexname = :i)"
        ),
        {"i": index_name},
    )
    return result.scalar()


def upgrade() -> None:
    """Upgrade schema."""
    if not _table_exists("cs_memos"):
        op.create_table(
            'cs_memos',
            sa.Column('title', sa.String(length=200), nullable=False, comment='메모 제목'),
            sa.Column('content', sa.Text(), nullable=False, comment='메모 내용'),
            sa.Column('memo_type', sa.String(length=30), nullable=False, comment='유형: inquiry, complaint, request, other'),
            sa.Column('center_id', sa.String(length=36), nullable=True, comment='관련 센터 ID'),
            sa.Column('center_name', sa.String(length=200), nullable=True, comment='센터명 비정규화'),
            sa.Column('created_by', sa.String(length=36), nullable=False, comment='작성자 admin_account_id'),
            sa.Column('created_by_name', sa.String(length=100), nullable=True, comment='작성자 이름 비정규화'),
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )

    if not _index_exists("idx_cs_memos_created_by"):
        op.create_index(
            'idx_cs_memos_created_by',
            'cs_memos',
            ['created_by', 'created_at'],
            postgresql_where=sa.text('deleted_at IS NULL'),
        )
    if not _index_exists("idx_cs_memos_center"):
        op.create_index(
            'idx_cs_memos_center',
            'cs_memos',
            ['center_id', 'created_at'],
            postgresql_where=sa.text('deleted_at IS NULL'),
        )
    if not _index_exists("idx_cs_memos_type"):
        op.create_index(
            'idx_cs_memos_type',
            'cs_memos',
            ['memo_type', 'created_at'],
            postgresql_where=sa.text('deleted_at IS NULL'),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_cs_memos_type', table_name='cs_memos')
    op.drop_index('idx_cs_memos_center', table_name='cs_memos')
    op.drop_index('idx_cs_memos_created_by', table_name='cs_memos')
    op.drop_table('cs_memos')
