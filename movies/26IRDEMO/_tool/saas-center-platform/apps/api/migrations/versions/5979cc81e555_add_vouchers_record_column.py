"""vouchers에 record 컬럼 — 추출 정규화 레코드 무손실 보존

Revision ID: 5979cc81e555
Revises: ea35f7da0d47
Create Date: 2026-07-29 13:17:52.972166

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5979cc81e555'
down_revision: Union[str, Sequence[str], None] = 'ea35f7da0d47'
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
    """Upgrade schema."""
    # 스키마 출처가 모델(create_all)·alembic 두 트랙이라 컬럼이 이미 있는 DB가 존재한다.
    if not _column_exists('vouchers', 'record'):
        op.add_column('vouchers', sa.Column('record', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    if _column_exists('vouchers', 'record'):
        op.drop_column('vouchers', 'record')
