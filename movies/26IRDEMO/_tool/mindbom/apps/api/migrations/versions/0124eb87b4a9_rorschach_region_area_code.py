"""rorschach region area_code column

Revision ID: 0124eb87b4a9
Revises: 2d67c3832d3e
Create Date: 2026-04-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0124eb87b4a9'
down_revision: Union[str, None] = '2d67c3832d3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'rorschach_regions',
        sa.Column('area_code', sa.String(length=20), nullable=True, comment='사용자가 선택/입력한 표준 영역 코드 (W/D1/Dd34 등)'),
    )


def downgrade() -> None:
    op.drop_column('rorschach_regions', 'area_code')
