"""voucher_forms.voucher_id 컬럼 추가 (nullable)

voucher draft 임베드 confirm 흐름에서 voucher 별로 VoucherForm row 가 복제 생성됨.
voucher_id=NULL 인 row 는 자료 공통 서식 (현재는 자동 추출에서 안 만들지만
수동 등록 여지를 위해 nullable).

Revision ID: a3c5b1e9d7f4
Revises: f2c4a9d6e1b3
Create Date: 2026-05-28 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3c5b1e9d7f4"
down_revision: Union[str, Sequence[str], None] = "f2c4a9d6e1b3"
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

    if not _column_exists(conn, "voucher_forms", "voucher_id"):
        op.add_column(
            "voucher_forms",
            sa.Column(
                "voucher_id",
                sa.String(length=36),
                nullable=True,
                comment=(
                    "vouchers.id 참조 (FK 제약 없음). "
                    "NULL 이면 자료 공통 서식."
                ),
            ),
        )
    if not _index_exists(conn, "ix_voucher_forms_voucher"):
        op.create_index(
            "ix_voucher_forms_voucher", "voucher_forms", ["voucher_id"]
        )


def downgrade() -> None:
    op.drop_index("ix_voucher_forms_voucher", table_name="voucher_forms")
    op.drop_column("voucher_forms", "voucher_id")
