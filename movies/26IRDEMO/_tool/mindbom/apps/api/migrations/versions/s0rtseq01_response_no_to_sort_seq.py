"""반응 번호를 정렬 서열로 격하 — response_no → sort_seq + 1..n 정리

왜 바꾸는가
-----------
`response_no`는 "카드 내 반응 번호"라는 이름으로 저장돼 화면에 그대로 찍혔는데,
**삭제가 재배열을 하지 않았다.** 1번을 지우면 화면에 2,3만 남고, 다음에 추가하면
`max+1`이라 1번은 영영 돌아오지 않는다.

근본 원인은 "카드 내 순번"이 두 곳에 있었던 것이다 — 이 컬럼과, 살아 있는 행들의
실제 순서. 삭제가 둘을 갈라놓는다.

실데이터(2026-08-25)에서 이미 벌어져 있었다. 카드 60개 중 5개:

    세션 05f23f1b 카드 1 : [2,3,4,5,6,7,8,9,10,10,11]   ← 10이 중복
    세션 05f23f1b 카드 4 : [1,2,4,5,6,7]
    세션 05f23f1b 카드 5 : [1,2,3,4,5,7,9,10,13,16]
    세션 ac269cf3 카드 10: [2,3,4,5]
    세션 e9de0cca 카드 1 : [2,3]

**중복이 결번보다 나쁘다.** `ORDER BY response_no`가 비결정적이 되어 표시 번호가
새로고침마다 바뀔 수 있었다.

무엇을 하는가
-------------
1. 컬럼 이름을 `sort_seq`로 바꾼다 — 이름이 역할을 말해야 다음 사람이
   `r.sort_seq`를 표시 번호로 착각하지 않는다. 표시 번호는 이제
   `completion.display_numbers()`가 매번 파생시킨다.
2. 기존 값을 카드마다 1..n으로 다시 매긴다(사용자 결정). 순서는 기존
   `response_no` → `created_at` → `id`로 정해 중복도 결정적으로 갈린다.

⚠️ 채점 결과는 바뀌지 않는다. R은 `len(codings)`로 세지 `max(response_no)`를
쓰지 않는다. 영향은 표시·정렬 뿐이었다.

되돌리기
--------
`downgrade()`는 이름만 되돌린다. **재배열은 되돌릴 수 없다** — 원래 값이
어디에도 남지 않기 때문이다. 되돌려야 하면 SQL 덤프를 쓸 것.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "s0rtseq01"
down_revision: Union[str, None] = "a4e4c0de01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "rorschach_responses",
        "response_no",
        new_column_name="sort_seq",
    )

    # 카드마다 1..n으로 다시 매긴다.
    #
    # 삭제된 행(deleted_at IS NOT NULL)은 번호 매김에서 **제외**한다 — 살아 있는
    # 것만 세는 것이 새 규칙(display_numbers)과 같은 기준이다. 삭제된 행의 값은
    # 건드리지 않고 그대로 둔다(감사추적).
    op.execute(
        sa.text(
            """
            WITH renumbered AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY session_id, card_no
                        ORDER BY sort_seq NULLS LAST, created_at, id
                    ) AS new_seq
                FROM rorschach_responses
                WHERE deleted_at IS NULL
            )
            UPDATE rorschach_responses AS r
            SET sort_seq = renumbered.new_seq
            FROM renumbered
            WHERE r.id = renumbered.id
              AND r.sort_seq IS DISTINCT FROM renumbered.new_seq
            """
        )
    )


def downgrade() -> None:
    # 이름만 되돌린다. 재배열 이전 값은 복원할 수 없다.
    op.alter_column(
        "rorschach_responses",
        "sort_seq",
        new_column_name="response_no",
    )
