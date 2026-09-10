"""voucher_forms 테이블 신규 + voucher_drafts.kind 컬럼 추가

부속 서식(이용신청서/동의서 등) HITL 큐 지원:
  - voucher_drafts.kind 추가 (voucher / form, default=voucher)
  - voucher_forms 테이블 신규 (file_id 기준 자료별 서식 보관)

confirmed_voucher_id 의 의미가 'voucher.id 또는 voucher_form.id'로 확장됨.

Revision ID: f2c4a9d6e1b3
Revises: 1d4e9d3fc362
Create Date: 2026-05-28 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f2c4a9d6e1b3"
down_revision: Union[str, Sequence[str], None] = "1d4e9d3fc362"
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


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. voucher_drafts.kind 추가 ──
    if not _column_exists(conn, "voucher_drafts", "kind"):
        op.add_column(
            "voucher_drafts",
            sa.Column(
                "kind",
                sa.String(length=20),
                nullable=False,
                server_default="voucher",
                comment="승격 대상 종류: voucher / form",
            ),
        )
    if not _index_exists(conn, "ix_voucher_drafts_kind"):
        op.create_index("ix_voucher_drafts_kind", "voucher_drafts", ["kind"])

    # ── 2. voucher_forms 테이블 신규 ──
    if not _table_exists(conn, "voucher_forms"):
        op.create_table(
            "voucher_forms",
            sa.Column(
                "id",
                sa.String(length=36),
                nullable=False,
                comment="UUID Primary Key",
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=False),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=False),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("deleted_at", sa.DateTime(timezone=False), nullable=True),
            sa.Column(
                "file_id",
                sa.String(length=36),
                nullable=False,
                comment="voucher_files.id 참조 (FK 제약 없음)",
            ),
            sa.Column(
                "name",
                sa.String(length=255),
                nullable=False,
                comment="서식명 (예: 이용신청서)",
            ),
            sa.Column(
                "category",
                sa.String(length=50),
                nullable=True,
                comment="서식 분류 (예: 신청 / 동의 / 계획 / 보고 / 기타)",
            ),
            sa.Column(
                "page_range",
                postgresql.INT4RANGE(),
                nullable=True,
                comment="자료 내 인쇄 페이지 범위",
            ),
            sa.Column("note", sa.Text(), nullable=True, comment="비고/설명"),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _index_exists(conn, "ix_voucher_forms_file"):
        op.create_index("ix_voucher_forms_file", "voucher_forms", ["file_id"])
    if not _index_exists(conn, "ix_voucher_forms_deleted_at"):
        op.create_index(
            "ix_voucher_forms_deleted_at", "voucher_forms", ["deleted_at"]
        )


def downgrade() -> None:
    op.drop_index("ix_voucher_forms_deleted_at", table_name="voucher_forms")
    op.drop_index("ix_voucher_forms_file", table_name="voucher_forms")
    op.drop_table("voucher_forms")

    op.drop_index("ix_voucher_drafts_kind", table_name="voucher_drafts")
    op.drop_column("voucher_drafts", "kind")
