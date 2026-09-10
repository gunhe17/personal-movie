"""voucher_forms.pages 컬럼 추가 (서식 페이지 PNG S3 경로 목록)

서식(VoucherForm)이 page_range(원본 PDF 페이지 포인터)만 갖던 구조에서,
해당 페이지를 PNG로 렌더한 S3 경로 목록(pages, JSONB)을 추가로 보유하도록 확장.
원본과 독립된 스냅샷이라 원본 PDF가 바뀌어도 서식 이미지는 보존된다.
page_range는 출처(provenance)로 그대로 유지.

Revision ID: c7d1f0a3b921
Revises: b5e2f48a91c7
Create Date: 2026-05-28 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c7d1f0a3b921"
down_revision: Union[str, Sequence[str], None] = "b5e2f48a91c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='voucher_forms' AND column_name='pages'"
    ))
    if result.scalar() is None:
        op.add_column(
            "voucher_forms",
            sa.Column(
                "pages",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
                comment=(
                    "서식 페이지를 PNG로 렌더한 S3 경로 목록 (page_range 순서대로). "
                    "원본 PDF와 독립된 스냅샷."
                ),
            ),
        )


def downgrade() -> None:
    op.drop_column("voucher_forms", "pages")
