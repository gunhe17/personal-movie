"""voucher: rename documents→files, drop draft typed columns→jsonb, add HITL machinery

기존 voucher 작업물(4개 untracked 마이그레이션)을 단일 통합 마이그레이션으로 정리.

변경 요약:
  1. voucher_documents → voucher_files (테이블 RENAME)
       + original_filename 컬럼 추가 + partial unique index
  2. voucher_document_links → voucher_file_links (테이블 RENAME)
       + document_id 컬럼 → file_id (RENAME)
       + unique constraint·index 이름 갱신
  3. voucher_drafts 신규 생성 (HITL 검토 대기 큐, data JSONB 자유 schema)
  4. vouchers: (name, program_year, program_organization) partial unique
     (활성 row 대상 멱등)

Revision ID: a4f9c2b18e07
Revises: affa1878dacf
Create Date: 2026-05-27 16:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a4f9c2b18e07"
down_revision: Union[str, Sequence[str], None] = "affa1878dacf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, name: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=:name"
    ), {"name": name})
    return result.scalar() is not None


def _column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:table AND column_name=:column"
    ), {"table": table, "column": column})
    return result.scalar() is not None


def _index_exists(conn, name: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname=:name"
    ), {"name": name})
    return result.scalar() is not None


def _constraint_exists(conn, name: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.table_constraints WHERE constraint_name=:name"
    ), {"name": name})
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. voucher_documents → voucher_files ──
    if _table_exists(conn, "voucher_documents") and not _table_exists(conn, "voucher_files"):
        op.rename_table("voucher_documents", "voucher_files")
    if _index_exists(conn, "ix_voucher_documents_type") and not _index_exists(conn, "ix_voucher_files_type"):
        op.execute("ALTER INDEX ix_voucher_documents_type RENAME TO ix_voucher_files_type")
    if _index_exists(conn, "ix_voucher_documents_deleted_at") and not _index_exists(conn, "ix_voucher_files_deleted_at"):
        op.execute("ALTER INDEX ix_voucher_documents_deleted_at RENAME TO ix_voucher_files_deleted_at")

    if _table_exists(conn, "voucher_files") and not _column_exists(conn, "voucher_files", "original_filename"):
        op.add_column(
            "voucher_files",
            sa.Column(
                "original_filename",
                sa.String(length=255),
                nullable=True,
                comment=(
                    "업로드 시점의 원본 파일명 (확장자 포함). "
                    "중복 업로드 차단·표시 용도."
                ),
            ),
        )
    if not _index_exists(conn, "uq_voucher_files_active_original_filename"):
        op.create_index(
            "uq_voucher_files_active_original_filename",
            "voucher_files",
            ["original_filename"],
            unique=True,
            postgresql_where=sa.text(
                "deleted_at IS NULL AND original_filename IS NOT NULL"
            ),
        )

    # ── 2. voucher_document_links → voucher_file_links ──
    if _table_exists(conn, "voucher_document_links") and not _table_exists(conn, "voucher_file_links"):
        op.rename_table("voucher_document_links", "voucher_file_links")
    if _table_exists(conn, "voucher_file_links") and _column_exists(conn, "voucher_file_links", "document_id"):
        op.alter_column("voucher_file_links", "document_id", new_column_name="file_id")
    if _constraint_exists(conn, "uq_voucher_document_link") and not _constraint_exists(conn, "uq_voucher_file_link"):
        op.execute(
            "ALTER TABLE voucher_file_links "
            "RENAME CONSTRAINT uq_voucher_document_link TO uq_voucher_file_link"
        )
    if _index_exists(conn, "ix_voucher_document_links_voucher") and not _index_exists(conn, "ix_voucher_file_links_voucher"):
        op.execute("ALTER INDEX ix_voucher_document_links_voucher RENAME TO ix_voucher_file_links_voucher")
    if _index_exists(conn, "ix_voucher_document_links_document") and not _index_exists(conn, "ix_voucher_file_links_file"):
        op.execute("ALTER INDEX ix_voucher_document_links_document RENAME TO ix_voucher_file_links_file")

    # ── 3. voucher_drafts 신규 (HITL 큐, JSONB 자유 schema) ──
    if not _table_exists(conn, "voucher_drafts"):
        op.create_table(
            "voucher_drafts",
            sa.Column("id", sa.String(length=36), nullable=False, comment="UUID Primary Key"),
            sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=False), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=False), nullable=True),
            sa.Column("file_id", sa.String(length=36), nullable=False, comment="voucher_files.id (FK 제약 없음)"),
            sa.Column("status", sa.String(length=20), server_default="pending", nullable=False, comment="pending / confirmed / rejected"),
            sa.Column("confirmed_voucher_id", sa.String(length=36), nullable=True, comment="status=confirmed 시 승격된 vouchers.id"),
            sa.Column("data", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb"), comment="LLM 추출 결과 — {field: {value, path}} 자유 schema"),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _index_exists(conn, "ix_voucher_drafts_file"):
        op.create_index("ix_voucher_drafts_file", "voucher_drafts", ["file_id"])
    if not _index_exists(conn, "ix_voucher_drafts_deleted_at"):
        op.create_index("ix_voucher_drafts_deleted_at", "voucher_drafts", ["deleted_at"])
    if not _index_exists(conn, "ix_voucher_drafts_status"):
        op.create_index("ix_voucher_drafts_status", "voucher_drafts", ["status"])

    # ── 4. vouchers partial unique (활성 행 대상 멱등) ──
    if not _index_exists(conn, "uq_vouchers_active_name_year_org"):
        op.create_index(
            "uq_vouchers_active_name_year_org",
            "vouchers",
            ["name", "program_year", "program_organization"],
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        )


def downgrade() -> None:
    # ── 4 ──
    op.drop_index("uq_vouchers_active_name_year_org", table_name="vouchers")

    # ── 3 ──
    op.drop_index("ix_voucher_drafts_status", table_name="voucher_drafts")
    op.drop_index("ix_voucher_drafts_deleted_at", table_name="voucher_drafts")
    op.drop_index("ix_voucher_drafts_file", table_name="voucher_drafts")
    op.drop_table("voucher_drafts")

    # ── 2 ──
    op.execute(
        "ALTER INDEX ix_voucher_file_links_file "
        "RENAME TO ix_voucher_document_links_document"
    )
    op.execute(
        "ALTER INDEX ix_voucher_file_links_voucher "
        "RENAME TO ix_voucher_document_links_voucher"
    )
    op.execute(
        "ALTER TABLE voucher_file_links "
        "RENAME CONSTRAINT uq_voucher_file_link TO uq_voucher_document_link"
    )
    op.alter_column(
        "voucher_file_links", "file_id", new_column_name="document_id"
    )
    op.rename_table("voucher_file_links", "voucher_document_links")

    # ── 1 ──
    op.drop_index(
        "uq_voucher_files_active_original_filename", table_name="voucher_files"
    )
    op.drop_column("voucher_files", "original_filename")
    op.execute(
        "ALTER INDEX ix_voucher_files_deleted_at "
        "RENAME TO ix_voucher_documents_deleted_at"
    )
    op.execute(
        "ALTER INDEX ix_voucher_files_type RENAME TO ix_voucher_documents_type"
    )
    op.rename_table("voucher_files", "voucher_documents")
