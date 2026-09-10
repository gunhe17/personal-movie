"""add voucher tables

Revision ID: 1a0dd3a01b98
Revises: b7f8e2a19c43
Create Date: 2026-05-06 05:51:02.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "1a0dd3a01b98"
down_revision: Union[str, Sequence[str], None] = "b7f8e2a19c43"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """vouchers / voucher_documents / voucher_document_links 테이블 생성."""

    # ── vouchers ──
    op.create_table(
        "vouchers",
        sa.Column("id", sa.String(length=36), nullable=False, comment="UUID Primary Key"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            server_default=sa.text("now()"),
            nullable=False,
            comment="생성 시각 (UTC)",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=False),
            server_default=sa.text("now()"),
            nullable=False,
            comment="수정 시각 (UTC)",
        ),
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=False),
            nullable=True,
            comment="삭제 시각 (UTC, Soft Delete)",
        ),
        sa.Column("name", sa.String(length=255), nullable=False, comment="바우처/서비스명"),
        sa.Column(
            "program_name", sa.String(length=255), nullable=False, comment="사업 이름"
        ),
        sa.Column(
            "program_organization",
            sa.String(length=255),
            nullable=False,
            comment="사업 기관",
        ),
        sa.Column("program_year", sa.Integer(), nullable=False, comment="사업 연도"),
        sa.Column("usage_start_date", sa.Date(), nullable=True),
        sa.Column("usage_end_date", sa.Date(), nullable=True),
        sa.Column("application_method", sa.Text(), nullable=True),
        sa.Column("application_start_date", sa.Date(), nullable=True),
        sa.Column("application_end_date", sa.Date(), nullable=True),
        sa.Column("support_amount", sa.Text(), nullable=True),
        sa.Column("support_scope", sa.Text(), nullable=True),
        sa.Column("support_target", sa.Text(), nullable=True),
        sa.Column("contact", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vouchers_program_year", "vouchers", ["program_year"])
    op.create_index(
        "ix_vouchers_program_organization", "vouchers", ["program_organization"]
    )
    op.create_index("ix_vouchers_deleted_at", "vouchers", ["deleted_at"])

    # ── voucher_documents ──
    op.create_table(
        "voucher_documents",
        sa.Column("id", sa.String(length=36), nullable=False, comment="UUID Primary Key"),
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
        sa.Column("name", sa.String(length=255), nullable=False, comment="자료 제목"),
        sa.Column(
            "type",
            sa.String(length=30),
            nullable=False,
            comment="자료 유형 (business_guide, manual, form, supplementary, notice)",
        ),
        sa.Column(
            "content",
            sa.Text(),
            nullable=True,
            comment="변환된 본문 (markdown). 페이지 경계는 HTML 주석 마커",
        ),
        sa.Column("source_url", sa.String(length=1024), nullable=True),
        sa.Column("source_site", sa.String(length=255), nullable=True),
        sa.Column("file_path", sa.String(length=512), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=False), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_voucher_documents_type", "voucher_documents", ["type"])
    op.create_index(
        "ix_voucher_documents_deleted_at", "voucher_documents", ["deleted_at"]
    )

    # ── voucher_document_links ──
    op.create_table(
        "voucher_document_links",
        sa.Column("id", sa.String(length=36), nullable=False, comment="UUID Primary Key"),
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
            "voucher_id",
            sa.String(length=36),
            nullable=False,
            comment="vouchers.id (FK 제약 없음)",
        ),
        sa.Column(
            "document_id",
            sa.String(length=36),
            nullable=False,
            comment="voucher_documents.id (FK 제약 없음)",
        ),
        sa.Column(
            "page_range",
            postgresql.INT4RANGE(),
            nullable=True,
            comment="자료 내 인쇄 페이지 범위",
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "voucher_id", "document_id", name="uq_voucher_document_link"
        ),
    )
    op.create_index(
        "ix_voucher_document_links_voucher",
        "voucher_document_links",
        ["voucher_id"],
    )
    op.create_index(
        "ix_voucher_document_links_document",
        "voucher_document_links",
        ["document_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_voucher_document_links_document", table_name="voucher_document_links"
    )
    op.drop_index(
        "ix_voucher_document_links_voucher", table_name="voucher_document_links"
    )
    op.drop_table("voucher_document_links")

    op.drop_index("ix_voucher_documents_deleted_at", table_name="voucher_documents")
    op.drop_index("ix_voucher_documents_type", table_name="voucher_documents")
    op.drop_table("voucher_documents")

    op.drop_index("ix_vouchers_deleted_at", table_name="vouchers")
    op.drop_index("ix_vouchers_program_organization", table_name="vouchers")
    op.drop_index("ix_vouchers_program_year", table_name="vouchers")
    op.drop_table("vouchers")
