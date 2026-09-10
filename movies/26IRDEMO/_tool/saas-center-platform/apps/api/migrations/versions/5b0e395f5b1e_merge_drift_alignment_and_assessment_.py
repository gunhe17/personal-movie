"""merge drift alignment and assessment/attendance fixes

Revision ID: 5b0e395f5b1e
Revises: aed7fdf3d8d7, c3f8a5d2e91b
Create Date: 2026-08-18 09:13:01.182532

배경
----
`a4c1d27e9b53`(directory_centers) 에서 두 갈래가 갈라져 head 가 둘이 됐다.
  - `aed7fdf3d8d7` 모델·DB 드리프트 정합
  - `c3f8a5d2e91b` 검사 세트 요약 키 정정 → 미시작 회기 출결 원복
배포 잡의 `alembic upgrade head` 는 head 가 둘이면 대상을 못 고르고 실패한다.
스키마 변경 없이 두 갈래를 다시 한 줄로 합치는 merge 리비전이다(내용 없음).

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b0e395f5b1e'
down_revision: Union[str, Sequence[str], None] = ('aed7fdf3d8d7', 'c3f8a5d2e91b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
