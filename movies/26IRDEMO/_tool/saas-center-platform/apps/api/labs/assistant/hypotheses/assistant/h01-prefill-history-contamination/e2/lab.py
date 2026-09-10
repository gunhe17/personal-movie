"""prefill-히스토리 오염 페어드 실험 — WUI 실측(2026-07-27) 가설 검증.

가설: 직전 턴이 prefill이면 _history_items가 step_tool_result만 복원해 텍스트-only로 보이고,
그 "무조회 즉답 시범"이 다음 턴의 자발 포기(도구 0콜 부재 단정)를 유발한다.
변형: text_only(현행 재현) / with_trace(prefill 흔적 복원안) / empty(새 대화 대조).
판정: query→prefill 완주 / 이륙(도구≥1) / 포기(도구 0콜). 실행(apps/api에서):
  uv run python labs/assistant/hypotheses/h01-prefill-history-contamination/e2/lab.py [N]
"""

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[5]))

from labs.assistant.env.prod_lab import run_utterance

UTTERANCE = "내일 오후 3시에 김민준 상담 일정 잡아줘"

_PREFILL_RESULT = json.dumps(
    {
        "navigated": "/counseling/receive",
        "prefilled": [],
        "note": "화면을 열고 입력값을 채웠습니다. 제출은 사용자가 화면에서 확인 후 직접 합니다.",
    },
    ensure_ascii=False,
)

_USER = {"role": "user", "content": "일정 등록해줘"}
_COMPLETION = {
    "role": "assistant",
    "content": "상담 일정 등록 화면이 열렸습니다. 해당 화면에서 직접 일정을 작성해 주시기 바랍니다.",
}

VARIANTS: dict[str, list[dict]] = {
    "text_only": [_USER, _COMPLETION],
    "with_trace": [
        _USER,
        {
            "role": "assistant",
            "content": [{
                "type": "tool_use", "id": "hlab_pf_1",
                "name": "prefill_counseling_receive_handler", "input": {},
            }],
        },
        {
            "role": "user",
            "content": [{
                "type": "tool_result", "tool_use_id": "hlab_pf_1",
                "content": _PREFILL_RESULT,
            }],
        },
        _COMPLETION,
    ],
    "empty": [],
}


def _judge(attempted: list) -> str:
    names = [n for n, _ in attempted]
    if not names:
        return "gave_up"
    queried = any(n == "query_client_handler" for n in names)
    # 값 있는 발화이므로 인자까지 채워 불러야 성공 — 빈 인자 prefill은 폼 미채움(WUI 실측)
    prefill_args = [a for n, a in attempted if n.startswith("prefill_")]
    prefilled_with_args = any(a for a in prefill_args)
    if queried and prefilled_with_args:
        return "success"
    if prefill_args and not prefilled_with_args:
        return "bare_prefill"  # 인자 없이 화면만 — 폼 미채움 모드
    return "partial"


async def main(n: int) -> None:
    out = Path(__file__).parent / "results.jsonl"
    counts: dict[str, dict[str, int]] = {v: {} for v in VARIANTS}
    for rep in range(n):
        for variant, history in VARIANTS.items():
            try:
                # MANAGER = owner_scope 없음 — 담당 스코프가 조회를 가리는 교란 제거(WUI 김원장과 동일 조건)
                r = await run_utterance(UTTERANCE, role="MANAGER", history=history, log=False)
                verdict = _judge(r.attempted)
                row = {
                    "variant": variant, "rep": rep, "verdict": verdict,
                    "tools": [(t, a) for t, a in r.attempted], "terminal": r.terminal,
                    "final_head": r.final_text[:80],
                    "at": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as e:  # 429 등 — 시행 무효 기록, 페어 유지 위해 계속
                verdict = "error"
                row = {"variant": variant, "rep": rep, "verdict": "error",
                       "error": str(e)[:120],
                       "at": datetime.now(timezone.utc).isoformat()}
            counts[variant][verdict] = counts[variant].get(verdict, 0) + 1
            with out.open("a") as f:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
            print(f"[{rep+1}/{n}] {variant:<10} → {verdict}", flush=True)
    print("\n=== 요약 ===")
    for variant, c in counts.items():
        total = sum(v for k, v in c.items() if k != "error") or 1
        ok = c.get("success", 0)
        print(f"{variant:<10} success {ok}/{total}  {dict(sorted(c.items()))}")


if __name__ == "__main__":
    asyncio.run(main(int(sys.argv[1]) if len(sys.argv) > 1 else 10))
