"""기록(원장) ledger_entries·ledger_media 신설

Revision ID: b7c1d94ae210
Revises: ea35f7da0d47
Create Date: 2026-07-29

autogenerate는 기존 스키마의 대량 드리프트(레거시 테이블 drop·전역 comment)를 함께
끌고 와 손으로 작성했다 — 이 마이그레이션은 신규 2테이블만 만든다.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b7c1d94ae210"
down_revision: Union[str, Sequence[str], None] = "ea35f7da0d47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    return op.get_bind().execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=:n)"
    ), {"n": name}).scalar()


def _index_exists(name: str) -> bool:
    return op.get_bind().execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes "
        "WHERE schemaname='public' AND indexname=:n)"
    ), {"n": name}).scalar()


def _create_index_if_missing(
    name: str,
    table: str,
    columns: list[str],
    *,
    unique: bool = False,
) -> None:
    if not _index_exists(name):
        op.create_index(name, table, columns, unique=unique)


def upgrade() -> None:
    # 스키마 출처가 모델(create_all)·alembic 두 트랙이라, 이 두 테이블이 이미 있는 DB가
    # 존재한다(개발 서버: head 분기로 alembic이 멈춘 사이 기동 시 create_all 이 생성).
    if _table_exists("ledger_entries"):
        _create_index_if_missing(
            op.f("ix_ledger_entries_profile_id"), "ledger_entries", ["profile_id"]
        )
        _create_index_if_missing(
            op.f("ix_ledger_entries_author_person_id"), "ledger_entries", ["author_person_id"]
        )
        _create_index_if_missing(
            "ix_ledger_entries_profile_occurred", "ledger_entries", ["profile_id", "occurred_at"]
        )
        _create_index_if_missing(
            "uq_ledger_entries_client_key", "ledger_entries", ["client_key"], unique=True
        )
    else:
        _create_ledger_entries()

    if _table_exists("ledger_media"):
        _create_index_if_missing(op.f("ix_ledger_media_entry_id"), "ledger_media", ["entry_id"])
    else:
        _create_ledger_media()


def _create_ledger_entries() -> None:
    op.create_table(
        "ledger_entries",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("profile_id", sa.String(length=36), nullable=False),
        sa.Column("author_person_id", sa.String(length=36), nullable=False),
        sa.Column("entry_type", sa.String(length=20), nullable=False),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("mood", sa.String(length=20), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("private_memo", sa.Text(), nullable=True),
        sa.Column("situation_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("bookmarked_at", sa.DateTime(), nullable=True),
        sa.Column("client_key", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_ledger_entries_profile_id"), "ledger_entries", ["profile_id"]
    )
    op.create_index(
        op.f("ix_ledger_entries_author_person_id"), "ledger_entries", ["author_person_id"]
    )
    op.create_index(
        "ix_ledger_entries_profile_occurred", "ledger_entries", ["profile_id", "occurred_at"]
    )
    op.create_index(
        "uq_ledger_entries_client_key", "ledger_entries", ["client_key"], unique=True
    )


def _create_ledger_media() -> None:
    op.create_table(
        "ledger_media",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("entry_id", sa.String(length=36), nullable=False),
        sa.Column("media_type", sa.String(length=10), nullable=False),
        sa.Column("upload_status", sa.String(length=20), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("checksum", sa.String(length=128), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("poster_path", sa.String(length=500), nullable=True),
        sa.Column("quota_month", sa.String(length=7), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ledger_media_entry_id"), "ledger_media", ["entry_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_ledger_media_entry_id"), table_name="ledger_media")
    op.drop_table("ledger_media")

    op.drop_index("uq_ledger_entries_client_key", table_name="ledger_entries")
    op.drop_index("ix_ledger_entries_profile_occurred", table_name="ledger_entries")
    op.drop_index(op.f("ix_ledger_entries_author_person_id"), table_name="ledger_entries")
    op.drop_index(op.f("ix_ledger_entries_profile_id"), table_name="ledger_entries")
    op.drop_table("ledger_entries")
