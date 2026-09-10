"""drop client_vouchers.case_id leftover

Revision ID: ea35f7da0d47
Revises: 5721e395a24a
Create Date: 2026-07-28 13:52:23.761452

1572993b0d9e 가 이미 drop 했지만, 그 리비전을 실행하지 않고 stamp 로 건너뛴 DB 에는
컬럼이 남아 모델(create_all)과 어긋난다. IF EXISTS 로 양쪽 DB 에 모두 적용 가능하게 정리한다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ea35f7da0d47'
down_revision: Union[str, Sequence[str], None] = '5721e395a24a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_client_vouchers_case_client_active")
    op.execute("DROP INDEX IF EXISTS idx_client_vouchers_case")
    op.execute("ALTER TABLE client_vouchers DROP COLUMN IF EXISTS case_id")


def downgrade() -> None:
    """과거 case_id 값은 복원되지 않는다(NULL) — BillableItem.related_case_id 로 재구성 가능."""
    op.add_column(
        'client_vouchers',
        sa.Column('case_id', sa.String(length=36), nullable=True),
    )
    op.create_index(
        'idx_client_vouchers_case',
        'client_vouchers',
        ['case_id'],
        postgresql_where='deleted_at IS NULL',
    )
    op.create_index(
        'uq_client_vouchers_case_client_active',
        'client_vouchers',
        ['case_id', 'client_id'],
        unique=True,
        postgresql_where='deleted_at IS NULL AND case_id IS NOT NULL',
    )
