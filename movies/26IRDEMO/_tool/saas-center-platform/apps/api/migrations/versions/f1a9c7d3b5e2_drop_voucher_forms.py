"""voucher_forms 테이블 은퇴 (부속 서식 개념 제거)

Revision ID: f1a9c7d3b5e2
Revises: a1f2b3c4d5e6
Create Date: 2026-06-11 00:00:00.000000

설계 변경: '부속 서식(voucher_forms)'을 별도 엔티티로 두지 않는다.
서식은 voucher_documents 로 연결된 global_document 의 한 종류일 뿐이며,
voucher_forms 는 이미 드롭된 voucher_files(file_id) 기반의 미사용 레거시였다.
→ 테이블/모델/엔드포인트를 모두 제거한다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f1a9c7d3b5e2"
down_revision: Union[str, Sequence[str], None] = "a1f2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """voucher_forms 테이블 제거 (인덱스 포함)."""
    conn = op.get_bind()
    if sa.inspect(conn).has_table("voucher_forms"):
        op.drop_table("voucher_forms")


def downgrade() -> None:
    """롤백 시 현재 스키마(file_id·voucher_id·pages 포함)로 재생성."""
    conn = op.get_bind()
    if sa.inspect(conn).has_table("voucher_forms"):
        return
    op.create_table(
        "voucher_forms",
        sa.Column(
            "id", sa.String(length=36), nullable=False, comment="UUID Primary Key"
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
            comment="voucher_files.id 참조 (FK 제약 없음) — 레거시",
        ),
        sa.Column(
            "voucher_id",
            sa.String(length=36),
            nullable=True,
            comment="vouchers.id 참조 (NULL=자료 공통 서식)",
        ),
        sa.Column(
            "name",
            sa.String(length=255),
            nullable=False,
            comment="서식명 (예: 이용신청서)",
        ),
        sa.Column(
            "page_range",
            postgresql.INT4RANGE(),
            nullable=True,
            comment="자료 내 인쇄 페이지 범위",
        ),
        sa.Column(
            "pages",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="서식 페이지 PNG S3 경로 목록",
        ),
        sa.Column("note", sa.Text(), nullable=True, comment="비고/설명"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_voucher_forms_file", "voucher_forms", ["file_id"])
    op.create_index("ix_voucher_forms_voucher", "voucher_forms", ["voucher_id"])
    op.create_index(
        "ix_voucher_forms_deleted_at", "voucher_forms", ["deleted_at"]
    )
