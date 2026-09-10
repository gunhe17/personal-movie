"""h01 E3 [확증] — prefill 히스토리 오염 페어드 재실측, 격리 세계(fixtures).

사전 등록(§1): E3 상수가 집행본 — 커밋 후 실행, 사후 변경은 탐색 강등.
record = 환경 구축(실험 아님): 실DB 1회 실행으로 도구 결과를 fixtures.json에 동결.
run    = 본실행: DB 미접근, 두 팔이 같은 fixtures 세계 — 남는 분산은 모델 확률성뿐.
실행(apps/api에서):
  uv run python labs/assistant/hypotheses/h01-prefill-history-contamination/e3/lab.py record
  uv run python labs/assistant/hypotheses/h01-prefill-history-contamination/e3/lab.py run
"""

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[5]))

from labs.assistant.env.mockenv import MockExecutor, RecordingExecutor
from labs.assistant.env.prod_lab import run_utterance
from labs.assistant.env.stats import report_paired

E3 = dict(
    n=20,                                  # MDE ~38%p < E1 관측 Δ 56%p → q>1 (해상도 충족)
    variants=("text_only", "with_trace"),  # 페어드 두 팔 — empty 대조는 E1에서 종결
    judge="query+prefill 인자 품질",        # E2 교훈: 호출 여부만 채점하면 빈-인자 함정
    role="MANAGER",                        # owner_scope가 조회를 가리는 교란 제거
    alpha=0.05,
)

UTTERANCE = "내일 오후 3시에 김민준 상담 일정 잡아줘"
FIXTURES = Path(__file__).parent / "fixtures.json"
RESULTS = Path(__file__).parent / "results.jsonl"

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
}


async def _call(**kw):
    """Poolside 429 파도(비통제 변수 §1-6)만 20s 재시도 — 그 외 예외는 관통."""
    for attempt in range(4):
        try:
            return await run_utterance(**kw)
        except Exception as e:
            if "429" not in str(e) or attempt == 3:
                raise
            print(f"  … 429 파도, 20s 대기 후 재시도 ({attempt + 1}/3)", flush=True)
            await asyncio.sleep(20)


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


async def record() -> None:
    for attempt in range(3):
        holder: dict = {}

        def factory(
            ctx,
            specs,
        ):
            holder["ex"] = RecordingExecutor(ctx, specs)
            return holder["ex"]

        await _call(
            utterance=UTTERANCE, role=E3["role"], history=[], log=False,
            executor_factory=factory,
        )
        ex = holder["ex"]
        if ex.recorded:
            FIXTURES.write_text(json.dumps(
                {
                    "recorded_from": UTTERANCE,
                    "role": E3["role"],
                    "permissions": list(ex.permissions),
                    "tools": ex.recorded,
                },
                ensure_ascii=False, indent=1, default=str,
            ))
            print(f"녹화 완료(시도 {attempt + 1}) → {sorted(ex.recorded)} → {FIXTURES.name}")
            return
        print(f"시도 {attempt + 1}: 도구 호출 없음(자발 포기 런) — 재시도")
    raise SystemExit("3회 모두 무호출 — 녹화 실패")


async def run() -> None:
    fx = json.loads(FIXTURES.read_text())
    perms = tuple(fx["permissions"])
    a: list[int] = []  # text_only(현행)
    b: list[int] = []  # with_trace(처방)
    for rep in range(E3["n"]):
        pair: dict[str, str] = {}
        for variant in E3["variants"]:
            try:
                r = await _call(
                    utterance=UTTERANCE,
                    role=E3["role"],
                    history=VARIANTS[variant],
                    log=False,
                    permissions=perms,
                    executor_factory=lambda _ctx, specs: MockExecutor(
                        specs, fx["tools"], perms
                    ),
                )
                verdict = _judge(r.attempted)
                row = {
                    "variant": variant, "rep": rep, "verdict": verdict,
                    "tools": [(t, ar) for t, ar in r.attempted], "terminal": r.terminal,
                    "final_head": r.final_text[:80],
                    "at": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as e:
                verdict = "error"
                row = {"variant": variant, "rep": rep, "verdict": "error",
                       "error": str(e)[:120],
                       "at": datetime.now(timezone.utc).isoformat()}
            pair[variant] = verdict
            with RESULTS.open("a") as f:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
            print(f"[{rep + 1}/{E3['n']}] {variant:<10} → {verdict}", flush=True)
        if "error" in pair.values():
            continue  # §1-6: 한쪽 에러 시 페어 통째 제외
        a.append(1 if pair["text_only"] == "success" else 0)
        b.append(1 if pair["with_trace"] == "success" else 0)
    print("\n=== 보고 표준형 (§5) ===")
    print(json.dumps(report_paired(a, b, f"e3/{RESULTS.name}"), ensure_ascii=False))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "run"
    if mode == "record":
        asyncio.run(record())
    elif mode == "run":
        asyncio.run(run())
    else:
        raise SystemExit("사용법: lab.py record | run")
