"""fix counseling case_code unique constraint to center scope

Revision ID: 49e748b2712a
Revises: a5596491eb9a
Create Date: 2026-02-25 11:37:53.122666

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '49e748b2712a'
down_revision: Union[str, Sequence[str], None] = 'a5596491eb9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """case_code: global unique → (center_id, case_code) composite unique"""
    # 1. 기존 글로벌 unique index 삭제
    op.drop_index('ix_counseling_cases_case_code', table_name='counseling_cases')

    # 2. 일반 index로 재생성 (검색 성능 유지)
    op.create_index('ix_counseling_cases_case_code', 'counseling_cases', ['case_code'], unique=False)

    # 3. 센터별 복합 unique constraint 추가
    op.create_unique_constraint('uq_counseling_case_code', 'counseling_cases', ['center_id', 'case_code'])


def downgrade() -> None:
    """복원: (center_id, case_code) composite unique → global unique"""
    # 1. 복합 unique constraint 삭제
    op.drop_constraint('uq_counseling_case_code', 'counseling_cases', type_='unique')

    # 2. 일반 index 삭제
    op.drop_index('ix_counseling_cases_case_code', table_name='counseling_cases')

    # 3. 글로벌 unique index 복원
    op.create_index('ix_counseling_cases_case_code', 'counseling_cases', ['case_code'], unique=True)
