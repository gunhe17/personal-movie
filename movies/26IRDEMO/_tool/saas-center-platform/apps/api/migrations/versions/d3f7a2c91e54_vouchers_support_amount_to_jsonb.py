"""vouchers.support_amount: Text → JSONB

`support_amount`을 구조화된 dict로 받기 위해 컬럼 타입 변경.
- 통화/월총액/등급별 등 자유 schema를 그대로 저장 (코드 상 약속)
- 원문 등 검증 단계 메타는 입력자(client)가 제거하고 보낸다는 전제
- 기존 문자열 데이터는 별도 정책 없이 null로 비움 (clean slate)

Revision ID: d3f7a2c91e54
Revises: c1e8d4f2a9b6
Create Date: 2026-05-28 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d3f7a2c91e54"
down_revision: Union[str, Sequence[str], None] = "c1e8d4f2a9b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT data_type FROM information_schema.columns "
        "WHERE table_name='vouchers' AND column_name='support_amount'"
    ))
    current_type = result.scalar()
    if current_type and current_type != "jsonb":
        op.alter_column(
            "vouchers",
            "support_amount",
            existing_type=sa.Text(),
            type_=postgresql.JSONB(astext_type=sa.Text()),
            existing_nullable=True,
            nullable=True,
            postgresql_using="NULL::jsonb",
            existing_comment="지원금 (요약 텍스트)",
            comment="지원금 구조화 정보 (자유 schema dict)",
        )


def downgrade() -> None:
    op.alter_column(
        "vouchers",
        "support_amount",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.Text(),
        existing_nullable=True,
        nullable=True,
        postgresql_using="NULL::text",
        existing_comment="지원금 구조화 정보 (자유 schema dict)",
        comment="지원금 (요약 텍스트)",
    )
