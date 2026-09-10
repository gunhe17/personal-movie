"""반응시간(R/T) 칸 제거 — first_utterance_at / latency_source

Revision ID: rt0drop01
Revises: m0vfix01

**Exner CS는 반응시간을 표준 기록 요소로 요구하지 않는다.**
"검사를 실시할 때 지나치게 시간에 신경을 쓸 필요는 없다"(워크북 27쪽).
구조요약에 들어가지 않으므로 채점에 영향이 없다.

게다가 채우던 값이 이름과 달랐다. `first_utterance_at`에 들어가던 것은
검사자의 **탭 시각**인데, 탭은 "이 반응이 끝났다"는 신호라 발화가 끝난 뒤에
온다 — 첫 발화 시각이 아니라 발화 **종료** 시각이고, R/T가 한 반응을 말한
시간만큼 길게 나왔다. 틀린 값이 맞는 값의 얼굴을 하고 있던 자리다
(§13 B-2가 "타이핑 시각으로 채우면 임상가 타자속도를 재는 것"이라 경고한 것과
같은 종류).

정확히 재려면 전사 조각의 발화 시작 시각을 끌어와야 하는데, 안 쓰는 값에
그 복잡도를 들일 이유가 없다. **안 재는 것과 틀리게 재는 것은 다르고, 둘 중
안 재는 쪽을 고른다.** 나중에 정말 필요해지면 그때 STT 시각으로 제대로 만든다.

기존 데이터: 값이 들어 있어도 위 이유로 신뢰할 수 없는 값이라 함께 버린다.
카드 제시 시각(`rorschach_card_administrations.presented_at`)은 남는다 —
그건 실제로 그 시각에 일어난 일이다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'rt0drop01'
down_revision: Union[str, None] = 'm0vfix01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('rorschach_responses', 'first_utterance_at')
    op.drop_column('rorschach_responses', 'latency_source')


def downgrade() -> None:
    # 되살려도 값은 돌아오지 않는다 — 애초에 신뢰할 수 없던 값이다.
    op.add_column(
        'rorschach_responses',
        sa.Column('latency_source', sa.String(length=20), nullable=True),
    )
    op.add_column(
        'rorschach_responses',
        sa.Column('first_utterance_at', sa.DateTime(), nullable=True),
    )
