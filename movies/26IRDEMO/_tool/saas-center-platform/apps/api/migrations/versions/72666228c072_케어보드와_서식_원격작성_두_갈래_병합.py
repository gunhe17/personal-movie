"""케어보드와 서식 원격작성 두 갈래 병합

Revision ID: 72666228c072
Revises: f0f93dcbdcdc, e7c3a1f04d28
Create Date: 2026-09-04

배경
----
`b3f7c2a9d514`(상담일지 공유 테이블) 에서 두 갈래가 갈라져 head 가 둘이 됐다.
  - `f0f93dcbdcdc` 케어보드 시간축·메모·읽음 테이블
  - `c4a1e8b2f931` → `d5b2f9c14e73` → `e7c3a1f04d28` 바우처 서식 템플릿 → 출처 id → 원격 작성 인증코드
배포 잡의 `alembic upgrade head` 는 head 가 둘이면 대상을 못 고르고 실패한다.
두 갈래가 건드리는 테이블이 겹치지 않아, 스키마 변경 없이 한 줄로 합치는 merge 리비전이다(내용 없음).

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = '72666228c072'
down_revision: Union[str, Sequence[str], None] = ('f0f93dcbdcdc', 'e7c3a1f04d28')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
