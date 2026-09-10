"""comprehensive reports tables

Revision ID: a1c0mprehen51
Revises: ba9c6943879d
Create Date: 2026-07-06

종합보고서(ComprehensiveReport) + 검사 연결(ComprehensiveReportExamination) 테이블 추가.
수동 작성: dormant examination_batteries 테이블을 건드리지 않음.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1c0mprehen51"
# 리베이스: 기존 보고서 기능 마이그레이션(c0mprehensive01) 위로 쌓아 단일 head 유지.
# (comprehensive_reports/_examinations는 독립 신규 테이블이라 순서 무관하게 안전)
down_revision: Union[str, None] = "c0mprehensive01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "comprehensive_reports",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("institution_id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("examiner_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("sections", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ai_draft", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ai_model_version", sa.String(length=50), nullable=True),
        sa.Column("ai_generated_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("confirmed_by", sa.String(length=36), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("report_generated_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
    )
    op.create_index(
        op.f("ix_comprehensive_reports_institution_id"),
        "comprehensive_reports", ["institution_id"], unique=False,
    )
    op.create_index(
        op.f("ix_comprehensive_reports_client_id"),
        "comprehensive_reports", ["client_id"], unique=False,
    )
    op.create_index(
        op.f("ix_comprehensive_reports_status"),
        "comprehensive_reports", ["status"], unique=False,
    )

    op.create_table(
        "comprehensive_report_examinations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("report_id", sa.String(length=36), nullable=False),
        sa.Column("examination_id", sa.String(length=36), nullable=False),
        sa.Column("exam_type", sa.String(length=20), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        op.f("ix_comprehensive_report_examinations_report_id"),
        "comprehensive_report_examinations", ["report_id"], unique=False,
    )
    op.create_index(
        op.f("ix_comprehensive_report_examinations_examination_id"),
        "comprehensive_report_examinations", ["examination_id"], unique=False,
    )
    op.create_index(
        "ix_crx_report_sort",
        "comprehensive_report_examinations", ["report_id", "sort_order"], unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_crx_report_sort", table_name="comprehensive_report_examinations")
    op.drop_index(
        op.f("ix_comprehensive_report_examinations_examination_id"),
        table_name="comprehensive_report_examinations",
    )
    op.drop_index(
        op.f("ix_comprehensive_report_examinations_report_id"),
        table_name="comprehensive_report_examinations",
    )
    op.drop_table("comprehensive_report_examinations")

    op.drop_index(op.f("ix_comprehensive_reports_status"), table_name="comprehensive_reports")
    op.drop_index(op.f("ix_comprehensive_reports_client_id"), table_name="comprehensive_reports")
    op.drop_index(op.f("ix_comprehensive_reports_institution_id"), table_name="comprehensive_reports")
    op.drop_table("comprehensive_reports")
