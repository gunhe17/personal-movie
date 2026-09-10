"""h05 E1 [확증] — 오염 발현의 와이어 의존성: 페어드 두 팔 = [openrouter vs direct].

사전 등록(§1): E1 상수가 집행본 — 이 파일의 등록 커밋이 실행 직전 커밋(h01 E3 교훈).
세계 = h01/e3에서 동결한 fixtures 사본, 히스토리 = text_only(오염 재현군) 고정 —
조작 변인은 와이어 하나(settings.POOLSIDE_DIRECT로 factory 라우팅 스위치).
실행(apps/api에서):
  uv run python labs/assistant/hypotheses/h05-wire-dependent-contamination/e1/lab.py
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
from labs.assistant.env.stats import report_paired

E1 = dict(
    n=20,                               # MDE ~38%p < 관측차 ~64%p(r2 대비 r1) → q≈1.7
    arms=("openrouter", "direct"),      # 페어드 두 팔 = 와이어 — 조작 변인 유일
    history="text_only",                # h01 오염 재현군 고정 (with_trace 부축은 본축 판정 후)
    judge="query+prefill 인자 품질",     # h01 strict judge 재사용
    role="MANAGER",
    alpha=0.05,
    m=1,
)

UTTERANCE = "내일 오후 3시에 김민준 상담 일정 잡아줘"
FIXTURES = Path(__file__).parent / "fixtures.json"
RESULTS = Path(__file__).parent / "results.jsonl"
RUN_ID = uuid.uuid4().hex[:8]  # 동시 기록 사고(h01 E3)의 처방 — 행마다 스탬프

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
    """429 파도(비통제 변수 §1-6)만 20s 재시도 — 그 외 예외는 관통."""
    for attempt in range(4):
        try:
            return await run_utterance(**kw)
        except Exception as e:
            if "429" not in str(e) or attempt == 3:
                raise
            print(f"  … 429 파도, 20s 대기 후 재시도 ({attempt + 1}/3)", flush=True)
            await asyncio.sleep(20)


async def main() -> None:
    fx = json.loads(FIXTURES.read_text())
    perms = tuple(fx["permissions"])
    a: list[int] = []  # openrouter (현행 무대였던 와이어)
    b: list[int] = []  # direct (플립된 무대)
    for rep in range(E1["n"]):
        pair: dict[str, str] = {}
        for wire in E1["arms"]:
            settings.POOLSIDE_DIRECT = wire == "direct"
            try:
                r = await _call(
                    utterance=UTTERANCE,
                    role=E1["role"],
                    history=TEXT_ONLY,
                    log=False,
                    permissions=perms,
                    executor_factory=lambda _ctx, specs: MockExecutor(
                        specs, fx["tools"], perms
                    ),
                )
                verdict = _judge(r.attempted)
                row = {
                    "run_id": RUN_ID, "wire": wire, "rep": rep, "verdict": verdict,
                    "tools": [(t, ar) for t, ar in r.attempted], "terminal": r.terminal,
                    "final_head": r.final_text[:80],
                    "at": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as e:
                verdict = "error"
                row = {"run_id": RUN_ID, "wire": wire, "rep": rep, "verdict": "error",
                       "error": str(e)[:120],
                       "at": datetime.now(timezone.utc).isoformat()}
            pair[wire] = verdict
            with RESULTS.open("a") as f:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
            print(f"[{rep + 1}/{E1['n']}] {wire:<10} → {verdict}", flush=True)
        if "error" in pair.values():
            continue  # §1-6: 한쪽 에러 시 페어 통째 제외
        a.append(1 if pair["openrouter"] == "success" else 0)
        b.append(1 if pair["direct"] == "success" else 0)
    print("\n=== 보고 표준형 (§5) ===")
    print(json.dumps(report_paired(a, b, f"e1/{RESULTS.name} run_id={RUN_ID}"),
                     ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
