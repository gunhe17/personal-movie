"""drop provider_registration_no from center_vouchers

Revision ID: affa1878dacf
Revises: 591a4c1b065f
Create Date: 2026-05-27 09:32:30.472171

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'affa1878dacf'
down_revision: Union[str, Sequence[str], None] = '591a4c1b065f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('center_vouchers', 'provider_registration_no')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        'center_vouchers',
        sa.Column(
            'provider_registration_no',
            sa.String(length=50),
            nullable=True,
            comment='제공기관 등록번호 (사업별 다름, 청구 시 필요)',
        ),
    )
