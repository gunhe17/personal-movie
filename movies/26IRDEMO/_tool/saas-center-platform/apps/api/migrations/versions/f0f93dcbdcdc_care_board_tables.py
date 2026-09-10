"""케어보드 시간축·메모·읽음 테이블 추가

Revision ID: f0f93dcbdcdc
Revises: b3f7c2a9d514
Create Date: 2026-09-02

autogenerate 초안에서 케어보드 3테이블만 남기고 기존 드리프트(legacy 테이블 drop·
comment 재작성)는 전부 걷어냈다 — 이 마이그레이션의 변경이 아니다.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f0f93dcbdcdc'
down_revision: Union[str, Sequence[str], None] = 'b3f7c2a9d514'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=:n"
        ),
        {"n": name},
    ).scalar() is not None


def upgrade() -> None:
    if not _table_exists("care_board_entries"):
        op.create_table(
            'care_board_entries',
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('center_id', sa.String(length=36), nullable=False),
            sa.Column('client_id', sa.String(length=36), nullable=False),
            sa.Column('kind', sa.String(length=20), nullable=False),
            sa.Column('occurred_at', sa.DateTime(), nullable=False),
            sa.Column('source_table', sa.String(length=50), nullable=False),
            sa.Column('source_id', sa.String(length=36), nullable=False),
            sa.Column('case_id', sa.String(length=36), nullable=True),
            sa.Column('actor_id', sa.String(length=36), nullable=True),
            sa.Column('person_id', sa.String(length=36), nullable=True),
            sa.Column('share_class', sa.String(length=20), nullable=False,
                      comment='fact|clinical|internal — 센터 간 인계 가능 등급'),
            sa.Column('title', sa.String(length=200), nullable=True),
            sa.Column('subtitle', sa.String(length=50), nullable=True),
            sa.Column('body', sa.String(length=300), nullable=True,
                      comment='표시용 절삭본 — LLM 입력으로 쓰지 않는다(원본 재조회)'),
            sa.Column('meta', sa.String(length=200), nullable=True),
            sa.Column('pinned', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('pinned_at', sa.DateTime(), nullable=True),
            sa.Column('pinned_by', sa.String(length=36), nullable=True),
            sa.Column('source_deleted_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_care_board_entries_center_id', 'care_board_entries', ['center_id'])
        op.create_index('ix_care_board_entries_client_id', 'care_board_entries', ['client_id'])
        op.create_index('ix_care_board_entries_case_id', 'care_board_entries', ['case_id'])
        op.create_index('ix_care_board_entries_person_id', 'care_board_entries', ['person_id'])
        op.create_index(
            'ix_care_board_entries_client_time',
            'care_board_entries',
            ['center_id', 'client_id', 'occurred_at'],
        )
        op.create_index(
            'uq_care_board_entries_source',
            'care_board_entries',
            ['source_table', 'source_id', 'client_id'],
            unique=True,
            postgresql_where=sa.text('deleted_at IS NULL'),
        )

    if not _table_exists("care_memos"):
        op.create_table(
            'care_memos',
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('center_id', sa.String(length=36), nullable=False),
            sa.Column('client_id', sa.String(length=36), nullable=False),
            sa.Column('author_id', sa.String(length=36), nullable=False),
            sa.Column('body', sa.Text(), nullable=False),
            sa.Column('edited_by', sa.String(length=36), nullable=True,
                      comment='작성자가 아닌 사람(관리자)이 고쳤을 때만'),
            sa.Column('edited_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_care_memos_center_id', 'care_memos', ['center_id'])
        op.create_index('ix_care_memos_client_id', 'care_memos', ['client_id'])
        op.create_index('ix_care_memos_client', 'care_memos', ['center_id', 'client_id', 'created_at'])

    if not _table_exists("care_board_reads"):
        op.create_table(
            'care_board_reads',
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('center_id', sa.String(length=36), nullable=False),
            sa.Column('client_id', sa.String(length=36), nullable=False),
            sa.Column('member_id', sa.String(length=36), nullable=False),
            sa.Column('last_seen_at', sa.DateTime(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_care_board_reads_center_id', 'care_board_reads', ['center_id'])
        op.create_index(
            'uq_care_board_reads_member',
            'care_board_reads',
            ['center_id', 'client_id', 'member_id'],
            unique=True,
            postgresql_where=sa.text('deleted_at IS NULL'),
        )


def downgrade() -> None:
    if _table_exists("care_board_reads"):
        op.drop_table('care_board_reads')
    if _table_exists("care_memos"):
        op.drop_table('care_memos')
    if _table_exists("care_board_entries"):
        op.drop_table('care_board_entries')
