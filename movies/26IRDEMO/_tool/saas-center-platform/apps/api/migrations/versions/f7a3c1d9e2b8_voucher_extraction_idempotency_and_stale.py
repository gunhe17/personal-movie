"""voucher 추출 stale 복구 컬럼 추가

P0a 버그 수정:
- voucher_files.extraction_started_at: PROCESSING 마킹 시각. timeout 지난
  PROCESSING 은 크래시로 고착된 stale 로 보고 재추출을 허용(영구 잠금 방지).

(멱등성은 별도 content_hash 가 아니라 SaveVouchersAsDraftService 의 replace
 시맨틱 — 추출 시 기존 pending 후보를 비우고 최신 세트로 교체 — 으로 처리하므로
 스키마 변경이 필요 없다. LLM 출력 비결정성에 강건.)

Revision ID: f7a3c1d9e2b8
Revises: 8972e7f7b6c8
Create Date: 2026-06-10 09:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a3c1d9e2b8"
down_revision: Union[str, Sequence[str], None] = "8972e7f7b6c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(conn, table: str, column: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": column})
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    if not _has_column(conn, "voucher_files", "extraction_started_at"):
        op.add_column(
            "voucher_files",
            sa.Column(
                "extraction_started_at",
                sa.DateTime(timezone=False),
                nullable=True,
                comment=(
                    "추출 시작 시각 (UTC). PROCESSING 마킹 시 기록. "
                    "stale 판정용"
                ),
            ),
        )


def downgrade() -> None:
    conn = op.get_bind()

    if _has_column(conn, "voucher_files", "extraction_started_at"):
        op.drop_column("voucher_files", "extraction_started_at")
