"""h05 E2 [확증] — 직결 와이어 단일 팔: 오염 재현군(text_only) 완주율 문턱 검정.

사전 등록(§1): E2 상수가 집행본 — 이 파일의 등록 커밋이 실행 직전 커밋.
페어드 아님 — 판정은 단일 비율의 Wilson 95% CI 하한 > THRESHOLD.
대조는 재호출하지 않는다: openrouter 팔은 동일 조건 실측이 이미 누적(h01 E1 1/9 +
E3 r1 3/14 = 4/23, Wilson 95% ≈ [7%, 37%]) — 문턱 40%는 그 상한 위(E1 설계 교체 사유).
실행(apps/api에서):
  uv run python labs/assistant/hypotheses/h05-wire-dependent-contamination/e2/lab.py
"""

import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[5]))

from app.core.config import settings
from labs.assistant.env.mockenv import MockExecutor
from labs.assistant.env.prod_lab import run_utterance
from labs.assistant.env.stats import wilson_ci

E2 = dict(
    n=20,                            # 예상 85%(r2)면 Wilson 하한 ~64% — 문턱 대비 여유
    wire="direct",                   # 단일 팔 — settings.POOLSIDE_DIRECT=True 강제
    history="text_only",             # h01 오염 재현군 고정
    judge="query+prefill 인자 품질",  # h01 strict judge 재사용
    threshold=0.40,                  # 성공 기준: Wilson 95% 하한 > 40% (openrouter 누적 상한 37% 위)
    role="MANAGER",
    alpha=0.05,
    m=1,
)

UTTERANCE = "내일 오후 3시에 김민준 상담 일정 잡아줘"
FIXTURES = Path(__file__).parent / "fixtures.json"
RESULTS = Path(__file__).parent / "results.jsonl"
RUN_ID = uuid.uuid4().hex[:8]

TEXT_ONLY = [
    {"role": "user", "content": "일정 등록해줘"},
    {
        "role": "assistant",
        "content": "상담 일정 등록 화면이 열렸습니다. 해당 화면에서 직접 일정을 작성해 주시기 바랍니다.",
    },
]


def _judge(attempted: list) -> str:
    names = [n for n, _ in attempted]
    if not names:
        return "gave_up"
    queried = any(n == "query_client_handler" for n in names)
    prefill_args = [a for n, a in attempted if n.startswith("prefill_")]
    prefilled_with_args = any(a for a in prefill_args)
    if queried and prefilled_with_args:
        return "success"
    if prefill_args and not prefilled_with_args:
        return "bare_prefill"
    return "partial"


async def _call(**kw):
    """429만 20s 재시도(직결은 미관측이나 방어 유지) — 그 외 예외는 관통."""
    for attempt in range(4):
        try:
            return await run_utterance(**kw)
        except Exception as e:
            if "429" not in str(e) or attempt == 3:
                raise
            print(f"  … 429, 20s 대기 후 재시도 ({attempt + 1}/3)", flush=True)
            await asyncio.sleep(20)


async def main() -> None:
    settings.POOLSIDE_DIRECT = True
    fx = json.loads(FIXTURES.read_text())
    perms = tuple(fx["permissions"])
    outcomes: list[int] = []
    for rep in range(E2["n"]):
        try:
            r = await _call(
                utterance=UTTERANCE,
                role=E2["role"],
                history=TEXT_ONLY,
                log=False,
                permissions=perms,
                executor_factory=lambda _ctx, specs: MockExecutor(
                    specs, fx["tools"], perms
                ),
            )
            verdict = _judge(r.attempted)
            row = {
                "run_id": RUN_ID, "wire": E2["wire"], "rep": rep, "verdict": verdict,
                "tools": [(t, ar) for t, ar in r.attempted], "terminal": r.terminal,
                "final_head": r.final_text[:80],
                "at": datetime.now(timezone.utc).isoformat(),
            }
            outcomes.append(1 if verdict == "success" else 0)
        except Exception as e:
            row = {"run_id": RUN_ID, "wire": E2["wire"], "rep": rep, "verdict": "error",
                   "error": str(e)[:120], "at": datetime.now(timezone.utc).isoformat()}
        with RESULTS.open("a") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"[{rep + 1}/{E2['n']}] {row['verdict']}", flush=True)

    k, n = sum(outcomes), len(outcomes)
    lo, hi = wilson_ci(k, n)
    print("\n=== 보고 (단일 비율 문턱 검정) ===")
    print(json.dumps({
        "success": f"{k}/{n}", "wilson95": [round(lo * 100, 1), round(hi * 100, 1)],
        "threshold_pp": E2["threshold"] * 100,
        "verdict_hint": "문턱 통과 — 직결 미발현 확증" if lo > E2["threshold"]
        else "문턱 미달", "run_id": RUN_ID, "results": f"e2/{RESULTS.name}",
    }, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
