"""조각의 label·color 컬럼 제거 — 반응 번호에서 파생되는 값이다

Revision ID: rgn0drop1
Revises: zfix0001

두 값 다 **소유 반응의 표시 번호에서 파생된다**:

    라벨 = 표시 번호(`display_numbers()`)   색 = `responseColor(번호)`

그런데 표시 번호 자체가 순서에서 파생된다(반응 번호는 저장하지 않는다).
그래서 반응을 하나 지우면 **저장된 label·color만 옛 번호에 머문다.**
읽는 쪽이 하나라도 남아 있으면 그 순간 화면과 갈린다 — 실제로 PDF가
그 옛 번호를 반응 라벨로 찍고 있었다(같은 세션에 고쳤다).

왜 "채워는 두되 안 읽는다"로 두지 않는가
----------------------------------------
그것이 지금까지의 상태였다. 화면은 파생시켜 쓰면서 저장은 계속 했고,
근거는 "DB만 보는 소비자(보고서·내보내기)가 있을 때 두 곳이 어긋나면
안 된다"였다. **거꾸로다.** 파생값을 낡은 채로 남겨두면 그 소비자를
돕는 게 아니라 속인다. 없으면 파생시킬 수밖에 없고, 있으면 믿는다.
**낡은 값은 없는 값보다 나쁘다.**

`color`는 한 번 더 나쁘다: 저장값은 그릴 당시 팔레트가 박제된 것이라
팔레트를 바꾸면 옛 조각만 옛 색으로 남는다. 화면은 이미 이 이유로
저장값을 버리고 파생시키고 있었다(`RegionOverlay.colorOf`).

되돌리기
--------
downgrade는 컬럼을 되살리되 **값은 복원하지 않는다**(라벨은 빈 문자열,
색은 기본 팔레트). 원래 값이 파생 가능하므로 잃는 정보가 없다.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'rgn0drop1'
down_revision: Union[str, None] = 'zfix0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('rorschach_regions', 'label')
    op.drop_column('rorschach_regions', 'color')


def downgrade() -> None:
    op.add_column(
        'rorschach_regions',
        sa.Column('color', sa.String(length=20), nullable=False, server_default='#3B82F6'),
    )
    op.add_column(
        'rorschach_regions',
        sa.Column('label', sa.String(length=20), nullable=False, server_default=''),
    )
