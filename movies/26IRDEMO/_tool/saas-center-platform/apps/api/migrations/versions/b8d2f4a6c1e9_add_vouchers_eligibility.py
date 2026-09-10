"""add vouchers eligibility column

Revision ID: b8d2f4a6c1e9
Revises: a3c9e17b52d4
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b8d2f4a6c1e9'
down_revision: Union[str, Sequence[str], None] = 'a3c9e17b52d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column}).scalar()


def upgrade() -> None:
    """Upgrade schema."""
    # 스키마 출처가 모델(create_all)·alembic 두 트랙이라 컬럼이 이미 있는 DB가 존재한다.
    if not _column_exists('vouchers', 'eligibility'):
        op.add_column(
            'vouchers',
            sa.Column('eligibility', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )


def downgrade() -> None:
    """Downgrade schema."""
    if _column_exists('vouchers', 'eligibility'):
        op.drop_column('vouchers', 'eligibility')
