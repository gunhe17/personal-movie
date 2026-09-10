"""계약 밖 z_score를 비운다 — 숫자로 저장된 Z값(옛 목업 산물)

Revision ID: zfix0001
Revises: rt0drop01

Z 부호는 네 개뿐이다: ZW · ZA · ZD · ZS (워크북 92쪽, 조직활동 Z).
채점은 `z in Z_TABLE[card_no]`로 조회하므로 `'5.5'` 같은 숫자 문자열은
**Zf·ZSum·Zd 어디에도 안 들어간다.** 에러 없이 그 반응만 조직활동에서
빠진다 — 화면에는 값이 차 있으니 아무도 모른다.

어디서 왔나
-----------
걷어낸 룰베이스 목업(`_rule_score_rorschach`, 2026-08-26 삭제)이
`z_score=[1.0, 2.5, 3.5, 4.0, 5.5][idx % 5]`를 돌려 만들었다. 저장 경로 셋
(임상가 저장·AI 초안·전수 감사) **모두 이 칸을 검증하지 않아** 그대로 굳었다.
같은 세션에 세 곳 다 검증을 붙였고, 이 마이그레이션은 이미 들어온 값을 치운다.

왜 비우는가 (고치지 않고)
-------------------------
숫자를 Z 부호로 되돌릴 수 없다. Z값은 **카드와 조직화 유형의 함수**라
(ZW/ZA/ZD/ZS는 카드마다 다른 값을 갖는다) 숫자 하나로는 어느 유형이었는지
알 수 없다. 추측해 채우면 틀린 값이 **맞는 것처럼** 저장된다 —
`_keep_known`이 `M`을 `Ma`로 안 고치는 것과 같은 이유다.

빈 칸은 임상가가 채운다. **지표는 변하지 않는다**: 이 값들은 애초에
Zf 집계에 들어간 적이 없다.

확정본(final_coding_json)도 포함한다
------------------------------------
확정된 기록을 건드리는 것이 마음에 걸리지만, 남겨두면 그 반응은 **재저장이
막힌다** — 새 검증이 400으로 거부하기 때문이다. 임상가가 다른 칸 하나를
고치려 해도 통째로 막힌다. 무효인 값을 지키느라 기록을 잠그는 셈이다.
지우는 것이 아니라 **무효였음을 인정하는 것**이다(값의 임상적 내용은 0).
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'zfix0001'
down_revision: Union[str, None] = 'rt0drop01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

#: 계약 어휘 (coding_codes.Z_SCORE_CODES와 같아야 한다)
_VALID_Z = ("ZW", "ZA", "ZD", "ZS")


def _null_out(col: str) -> str:
    """계약 밖 z_score를 JSON null로 바꾼다.

    `-> 'z_score'`(jsonb)로 비교한다. `->>`(text)를 쓰면 **JSON null이
    SQL NULL이 되어** `NOT IN` 조건이 UNKNOWN으로 떨어지고, 이미 비어 있는
    행이 조건에서 조용히 빠진다 — 여기선 결과가 같지만, 같은 꼴의 조건을
    베껴 쓸 때 사라지는 행이 생기는 자리다.
    """
    valid = ", ".join(f"'\"{z}\"'::jsonb" for z in _VALID_Z)
    return f"""
        UPDATE rorschach_responses
        SET {col} = jsonb_set({col}::jsonb, '{{z_score}}', 'null'::jsonb)
        WHERE {col} IS NOT NULL
          AND {col}::jsonb ? 'z_score'
          AND {col}::jsonb -> 'z_score' <> 'null'::jsonb
          AND {col}::jsonb -> 'z_score' NOT IN ({valid})
    """


def upgrade() -> None:
    for col in ("ai_coding_json", "final_coding_json"):
        op.execute(_null_out(col))


def downgrade() -> None:
    """되돌리지 않는다.

    무엇을 비웠는지 값이 남아 있지 않으므로 복원할 수 없다. 되돌린 척하는
    downgrade는 없는 것보다 나쁘다 — 복구된 줄 알고 지나간다.
    """
    pass
