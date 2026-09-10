"""h09 E1 [확증] — 선언-정지(자발 포기 최강 프로브)의 직결 발현률 문턱 검정.

사전 등록(§1): E1 상수가 집행본 — 이 커밋 = 등록 커밋 = 실행 직전.
단일 팔(직결·실DB — 경유 역사 실측 3/3과 같은 세계, 조작 변인은 와이어뿐).
판정: 발현률 Wilson 95% 상한 < 40% (경유 100%의 하한 43.8% 아래 = CI 비중첩).
judge는 역사 실측과 동일(어미 선언 마감) — 비교 유효성 우선, hops·본문은 포렌식용 병기.
실행(apps/api에서):
  uv run python labs/assistant/hypotheses/h09-giveup-wire-artifact/e1/lab.py
"""

import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[5]))

from app.core.config import settings
from labs.assistant.env.prod_lab import MULTITURN, run_utterance
from labs.assistant.env.stats import wilson_ci

E1 = dict(
    n=20,
    wire="direct",                   # settings.POOLSIDE_DIRECT=True 강제
    probe="mt_fabricate",            # 경유 실측 선언-정지 3/3의 그 프로브·그 히스토리
    judge="어미 선언-정지(하겠습니다/할게요/볼게요 마감) — 역사 실측과 동일",
    threshold=0.40,
    alpha=0.05,
    m=1,
)

PROBE = next(m for m in MULTITURN if m["id"] == "mt_fabricate")
RESULTS = Path(__file__).parent / "results.jsonl"
RUN_ID = uuid.uuid4().hex[:8]

_DECL_SUFFIX = ("하겠습니다.", "할게요.", "볼게요.")


def _judge(text: str) -> str:
    return "선언정지" if text.strip().endswith(_DECL_SUFFIX) else "비발현"


async def _call(**kw):
    """429만 20s 재시도(직결 미관측이나 방어 유지) — 그 외 예외는 관통."""
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
    outcomes: list[int] = []
    for rep in range(E1["n"]):
        try:
            r = await _call(
                utterance=PROBE["utterance"],
                role=PROBE["role"],
                history=PROBE.get("history"),
                log=False,
            )
            verdict = _judge(r.final_text)
            row = {
                "run_id": RUN_ID, "wire": E1["wire"], "rep": rep, "verdict": verdict,
                "hops": len(r.attempted), "terminal": r.terminal,
                "final_head": r.final_text[:120],
                "at": datetime.now(timezone.utc).isoformat(),
            }
            outcomes.append(1 if verdict == "선언정지" else 0)
        except Exception as e:
            row = {"run_id": RUN_ID, "wire": E1["wire"], "rep": rep, "verdict": "error",
                   "error": str(e)[:120], "at": datetime.now(timezone.utc).isoformat()}
        with RESULTS.open("a") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"[{rep + 1}/{E1['n']}] {row['verdict']} (hops={row.get('hops', '-')})", flush=True)

    k, n = sum(outcomes), len(outcomes)
    lo, hi = wilson_ci(k, n)
    print("\n=== 보고 (단일 비율 문턱 검정) ===")
    print(json.dumps({
        "선언정지": f"{k}/{n}", "wilson95": [round(lo * 100, 1), round(hi * 100, 1)],
        "threshold_pp": E1["threshold"] * 100,
        "verdict_hint": "확증 — 직결에서 소멸(경유 CI와 비중첩)" if n and hi < E1["threshold"]
        else "문턱 미달", "run_id": RUN_ID, "results": f"e1/{RESULTS.name}",
    }, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
