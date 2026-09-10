"""저장된 로르샤하 코딩이 계약 어휘를 지키는지 검사한다.

왜 필요한가
-----------
채점(`scoring.py`)은 부호를 **이름으로** 읽는다. 철자가 다르면 에러 없이
그 지표만 0이 된다 — 화면은 멀쩡히 그려지고 아무도 모른다.

실제로 두 번 그랬다:
  - 영역 부호: 완전일치만 인정해 번호 붙은 값 43건이 집계에서 사라짐
  - 결정인·특수점수: 옛 목업이 만든 `INC1`(INCOM1 오타)·`M`/`FM`/`ma`
    (능동·수동 접미사 누락)가 확정 검사 4건에 굳음 (2026-08-25 정리)

지금은 두 쓰기 경로에 검증이 있다(임상가 저장 `CodingUpdateRequest`,
AI 초안 `_keep_known`). 이 스크립트는 **그 검증이 새는지**를 본다 —
새 경로가 생기거나, 마이그레이션이 값을 직접 넣거나, DB를 손으로 고쳤을 때.

쓰는 법
-------
    cd apps/api && uv run python scripts/audit_coding_codes.py

위반이 있으면 종료코드 1. CI에 붙일 수 있다.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.modules.examination.rorschach.coding_codes import (  # noqa: E402
    CONTENT_CODES,
    DETERMINANT_CODES,
    SPECIAL_SCORE_CODES,
    is_known_code,
    is_valid_location,
)

GROUPS = {
    "determinants": set(DETERMINANT_CODES),
    "contents": set(CONTENT_CODES),
    "special_scores": set(SPECIAL_SCORE_CODES),
}

# 칸 하나짜리 부호 — 저장 키 → 계약 그룹 이름.
# 이 셋도 채점이 이름으로 읽는다: dq→DQ+·DQv / fq→X+%·XA% / z_score→Zf·ZSum.
# 2026-08-26까지 두 쓰기 경로와 이 스크립트 **셋 다** 이 칸들을 안 봤다.
SCALAR_GROUPS = {"dq": "dq", "fq": "fq", "z_score": "zScore"}

# 삭제된 검사는 보지 않는다 — 이미 폐기한 데이터까지 세면 신호가 죽는다.
QUERY = """
    SELECT r.id, r.card_no, e.id AS exam_id, e.status,
           r.ai_coding_json, r.final_coding_json
    FROM rorschach_responses r
    JOIN rorschach_sessions s ON s.id = r.session_id
    JOIN examinations e ON e.id = s.examination_id
    WHERE r.deleted_at IS NULL AND e.deleted_at IS NULL
"""


def violations(coding: dict) -> list[str]:
    """이 코딩이 어긴 것들. 빈 목록이면 계약을 지킨다."""
    bad = [
        f"{group}={code}"
        for group, known in GROUPS.items()
        for code in (coding.get(group) or [])
        if code not in known
    ]
    bad += [
        f"{key}={coding.get(key)!r}"
        for key, group in SCALAR_GROUPS.items()
        if not is_known_code(group, coding.get(key))
    ]
    # location은 목록이 아니라 형태로 본다 — 세부 번호(D1·Dd21)가 붙어
    # 조합이 무한하다. None은 "아직 안 골랐다"라 위반이 아니다.
    loc = coding.get("location")
    if loc is not None and not is_valid_location(loc):
        bad.append(f"location={loc}")
    return bad


async def main() -> int:
    engine = create_async_engine(settings.DATABASE_URL)
    try:
        async with engine.connect() as conn:
            rows = (await conn.execute(text(QUERY))).fetchall()
    finally:
        await engine.dispose()

    found = 0
    for resp_id, card_no, exam_id, status, ai, final in rows:
        for label, coding in (("AI 초안", ai), ("확정", final)):
            if not coding:
                continue
            bad = violations(coding)
            if not bad:
                continue
            found += 1
            print(
                f"  검사 {str(exam_id)[:8]} ({status})  반응 {str(resp_id)[:8]} "
                f"카드 {card_no}  [{label}]  {', '.join(bad)}"
            )

    print(f"\n코딩 {len(rows)}개 반응 검사 — 위반 {found}건")
    if found:
        print(
            "\n⚠️ 채점이 이 부호들을 못 읽는다. 해당 지표는 에러 없이 0이 된다.\n"
            "   어느 경로로 들어왔는지부터 볼 것 — 검증을 안 거치는 쓰기 경로가"
            " 있다는 뜻이다."
        )
    return 1 if found else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
