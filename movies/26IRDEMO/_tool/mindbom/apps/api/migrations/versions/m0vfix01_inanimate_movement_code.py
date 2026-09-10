"""무생물운동 결정인 표기 교정 — m'a/m'p/m'a-p → ma/mp/ma-p

Revision ID: m0vfix01
Revises: e622f2c04cb1

워크북 〈표 3-1〉 결정인 기호와 기준(56쪽)에 따르면 무생물운동반응의 기호는
**소문자 `m`**이다. 아포스트로피는 무채색(`C'`·`C'F`·`FC'`)에만 붙는다.
본문도 "M이나 m", "M과 m 기호"로 일관한다(58쪽).

코드는 `m'a`를 쓰고 있었다. 계약 어휘와 감사 스크립트가 그 값을 정답으로
알고 있어 전수 검사도 통과했다 — 검사는 "내가 정한 어휘를 지키는가"만 봤다.

저장된 코딩(`ai_coding_json` / `final_coding_json`)의 `determinants` 배열
안에서만 바꾼다. 다른 칸(내용·특수점수)에는 이 값이 들어갈 수 없다.

⚠️ `m'a-p`를 먼저 바꾼다. `m'a`를 먼저 치환하면 `m'a-p`가 `ma-p`가 아니라
`ma'-p`꼴로 남는다(부분 일치).
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'm0vfix01'
down_revision: Union[str, None] = 'e622f2c04cb1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

#: (옛 값, 새 값) — 긴 것부터
_RENAMES = [("m'a-p", "ma-p"), ("m'a", "ma"), ("m'p", "mp")]


def _rewrite(old: str, new: str) -> str:
    """determinants 배열의 원소 하나를 바꾸는 SQL.

    jsonb 배열을 풀어 원소마다 치환한 뒤 다시 모은다. 문자열 전체를 치환하면
    다른 칸에 우연히 같은 글자가 있을 때 함께 바뀐다.

    ⚠️ **옛 값이 작은따옴표를 품고 있다**(`m'a`). SQL 리터럴 안에서 `''`로
    이스케이프하지 않으면 문자열이 그 자리에서 끊겨 구문 오류가 난다 —
    바꾸려는 대상이 곧 구분자인, 이 마이그레이션 고유의 함정이다.
    """
    old = old.replace("'", "''")
    new = new.replace("'", "''")
    return f"""
        UPDATE {{table}} SET {{col}} = jsonb_set(
            {{col}}::jsonb,
            '{{{{determinants}}}}',
            (
                SELECT jsonb_agg(CASE WHEN d = '{old}' THEN '{new}' ELSE d END)
                FROM jsonb_array_elements_text({{col}}::jsonb -> 'determinants') AS d
            )
        )
        WHERE {{col}} IS NOT NULL
          AND {{col}}::jsonb -> 'determinants' @> '["{old}"]'::jsonb
    """


def _apply(renames) -> None:
    for col in ("ai_coding_json", "final_coding_json"):
        for old, new in renames:
            op.execute(
                _rewrite(old, new).format(table="rorschach_responses", col=col)
            )


def upgrade() -> None:
    _apply(_RENAMES)


def downgrade() -> None:
    # 되돌릴 때도 긴 것부터 — 'ma'를 먼저 바꾸면 'ma-p'가 깨진다.
    _apply([(new, old) for old, new in _RENAMES])
