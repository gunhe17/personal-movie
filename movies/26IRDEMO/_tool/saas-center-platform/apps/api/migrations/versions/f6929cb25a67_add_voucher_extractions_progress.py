"""voucher_extractions에 progress 컬럼

Revision ID: f6929cb25a67
Revises: 5979cc81e555
Create Date: 2026-07-29 16:14:38.837992

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f6929cb25a67'
down_revision: Union[str, Sequence[str], None] = '5979cc81e555'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(
    table: str,
    column: str,
) -> bool:
    return op.get_bind().execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column}).scalar()


def upgrade() -> None:
    # 스키마 출처가 모델(create_all)·alembic 두 트랙이라 컬럼이 이미 있는 DB가 존재한다.
    if not _column_exists('voucher_extractions', 'progress'):
        op.add_column('voucher_extractions', sa.Column('progress', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    if _column_exists('voucher_extractions', 'progress'):
        op.drop_column('voucher_extractions', 'progress')

