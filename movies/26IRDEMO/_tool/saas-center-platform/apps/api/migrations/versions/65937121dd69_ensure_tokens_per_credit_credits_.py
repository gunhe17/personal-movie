"""ensure tokens_per_credit credits_charged on llm_calls (idempotent backfill)

llm_calls 모델에 tokens_per_credit / credits_charged 가 있으나 DB 에 컬럼이 없어
크레딧 기록 INSERT 가 UndefinedColumnError 로 실패함(member_id 와 동일한 드리프트).
IF NOT EXISTS 로 멱등 보정.

Revision ID: 65937121dd69
Revises: 5f47e79cf2e2
Create Date: 2026-06-04 22:55:27.331527

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '65937121dd69'
down_revision: Union[str, Sequence[str], None] = '5f47e79cf2e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema (idempotent)."""
    op.execute("ALTER TABLE llm_calls ADD COLUMN IF NOT EXISTS tokens_per_credit INTEGER")
    op.execute("ALTER TABLE llm_calls ADD COLUMN IF NOT EXISTS credits_charged INTEGER")


def downgrade() -> None:
    """Downgrade schema (idempotent)."""
    op.execute("ALTER TABLE llm_calls DROP COLUMN IF EXISTS credits_charged")
    op.execute("ALTER TABLE llm_calls DROP COLUMN IF EXISTS tokens_per_credit")
