"""voucher_forms.category 컬럼 제거

자동 추출되지 않고 비즈니스 로직에서도 사용처가 없어 dead 필드로 판정. 제거.
필요해질 때 enum 으로 다시 추가할 수 있음.

Revision ID: b5e2f48a91c7
Revises: a3c5b1e9d7f4
Create Date: 2026-05-28 15:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b5e2f48a91c7"
down_revision: Union[str, Sequence[str], None] = "a3c5b1e9d7f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='voucher_forms' AND column_name='category'"
    ))
    if result.scalar() is not None:
        op.drop_column("voucher_forms", "category")


def downgrade() -> None:
    op.add_column(
        "voucher_forms",
        sa.Column(
            "category",
            sa.String(length=50),
            nullable=True,
            comment="서식 분류 (예: 신청 / 동의 / 계획 / 보고 / 기타)",
        ),
    )
