"""ensure member_id on llm_calls (idempotent backfill)

기존 1bb96269218f 가 llm_calls.member_id 를 추가하도록 돼 있으나, alembic_version 은
head 로 찍혀 있는데 실제 컬럼이 없는 상태(머지/스탬프 과정에서 DDL 미반영)가 관찰됨
→ INSERT 시 UndefinedColumnError 발생. 컬럼/인덱스를 IF NOT EXISTS 로 멱등 보정한다.
(이미 존재하면 no-op 이라 재실행/정상 환경에서도 안전.)

Revision ID: 5f47e79cf2e2
Revises: b3b4f6b364b6
Create Date: 2026-06-04 20:53:48.883815

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5f47e79cf2e2'
down_revision: Union[str, Sequence[str], None] = 'b3b4f6b364b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema (idempotent)."""
    op.execute(
        "ALTER TABLE llm_calls ADD COLUMN IF NOT EXISTS member_id VARCHAR(36)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_llm_calls_member_id "
        "ON llm_calls (member_id)"
    )


def downgrade() -> None:
    """Downgrade schema (idempotent)."""
    op.execute("DROP INDEX IF EXISTS ix_llm_calls_member_id")
    op.execute("ALTER TABLE llm_calls DROP COLUMN IF EXISTS member_id")
