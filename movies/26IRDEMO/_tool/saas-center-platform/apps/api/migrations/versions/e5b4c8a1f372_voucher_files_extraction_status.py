"""voucher_files: extraction_status + extraction_error 컬럼 추가

PDF → voucher 추출 파이프라인이 비동기(BackgroundTasks)로 실행되면서
상태 추적이 필요. 프론트엔드가 폴링해서 processing→completed 전환을 감지.

상태 값:
  - idle: 추출 전 (default)
  - processing: 진행 중
  - completed: 추출·정규화·draft 저장 모두 성공
  - failed: 파이프라인 중간에 실패 (extraction_error 에 사유)

Revision ID: e5b4c8a1f372
Revises: 40092f642081
Create Date: 2026-05-28 11:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5b4c8a1f372"
down_revision: Union[str, Sequence[str], None] = "40092f642081"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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

    if not _column_exists(conn, "voucher_files", "extraction_status"):
        op.add_column(
            "voucher_files",
            sa.Column(
                "extraction_status",
                sa.String(length=20),
                nullable=False,
                server_default="idle",
                comment="PDF→voucher 추출 상태: idle / processing / completed / failed",
            ),
        )
    if not _column_exists(conn, "voucher_files", "extraction_error"):
        op.add_column(
            "voucher_files",
            sa.Column(
                "extraction_error",
                sa.Text(),
                nullable=True,
                comment="추출 실패 시 에러 메시지 (status=failed 일 때만 의미 있음)",
            ),
        )
    if not _column_exists(conn, "voucher_files", "extraction_completed_at"):
        op.add_column(
            "voucher_files",
            sa.Column(
                "extraction_completed_at",
                sa.DateTime(timezone=False),
                nullable=True,
                comment="추출 완료 시각 (UTC). 폴링 캐시 무효화용",
            ),
        )
    if not _index_exists(conn, "ix_voucher_files_extraction_status"):
        op.create_index(
            "ix_voucher_files_extraction_status",
            "voucher_files",
            ["extraction_status"],
        )


def downgrade() -> None:
    op.drop_index("ix_voucher_files_extraction_status", table_name="voucher_files")
    op.drop_column("voucher_files", "extraction_completed_at")
    op.drop_column("voucher_files", "extraction_error")
    op.drop_column("voucher_files", "extraction_status")
