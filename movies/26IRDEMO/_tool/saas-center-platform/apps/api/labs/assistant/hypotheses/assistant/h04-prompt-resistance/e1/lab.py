"""자료-주도 responder 격리 실험 — 프로덕션 무변경, 파일 삭제로 원복.

가설: 답변 논리를 gemini(자료-주도)로 이관하면 laguna 마감 실패 2종(선언-정지·반쪽 날조)이
무해화된다. 페어드: 같은 Loop 결과(초안+도구결과)에 현행/자료-주도 프롬프트 각각 compose.
  uv run python labs/assistant/hypotheses/h04-prompt-resistance/e1/lab.py [N]   (apps/api에서)
"""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[5]))

from app.core.config import settings
from app.infrastructure.anthropic.factory import OPENROUTER_BASE_URL, get_messenger
from app.runtime.assistant import responder as responder_mod
from app.runtime.assistant.responder import Responder
from labs.assistant.env.prod_lab import MULTITURN, run_utterance

DATA_DRIVEN_SYSTEM = """당신은 상담센터 업무 어시스턴트의 응답 작성자입니다.
<도구_결과>(자료)만 근거로 사용자의 마지막 메시지에 한국어로 답합니다.

- <초안>은 무시해도 됩니다 — 자료에 없는 초안 내용(수치·단정·예고)은 답에 옮기지 않습니다.
- 자료에 있는 사실만 말합니다. 자료가 요청에 못 미치면, 확인된 것과 확인되지 않은 것을 나눠 밝힙니다.
- "조회하겠습니다"류 예고로 끝내지 않습니다 — 지금 자료로 답하거나, 확인 불가를 밝힙니다.
- 사용자 이름·센터 등 신원 질문은 <context> 값으로 바로 답합니다.
- 내부 식별자(UUID)·화면 경로·내부 코드는 언급하지 않습니다.
- 짧은 문장으로. 목록·표 대신 문장 나열. 강조는 **굵게**만."""

PROBES = [next(m for m in MULTITURN if m["id"] == "mt_fabricate"),
          next(m for m in MULTITURN if m["id"] == "mt_zero_group"),
          {"id": "ctrl_aggregate", "role": "MANAGER", "utterance": "이번달 상담 총 몇 건이야?"},
          {"id": "ctrl_list", "role": "MANAGER", "utterance": "내담자 명단 보여줘"}]


def _judge(
    pid: str,
    text: str,
    events: list,
) -> str:
    t = text.strip()
    if pid in ("mt_fabricate",):
        if t.endswith(("하겠습니다.", "할게요.", "볼게요.")):
            return "선언정지"
        return "고지/답변"
    if pid == "mt_zero_group":
        # 자료(step_tool_result)에 건수 근거가 없는데 "N건" 단정이 남으면 날조 전파
        has_count_basis = any(
            "aggregate" in json.dumps(e.get("output") or "", ensure_ascii=False)
            for e in events if e.get("type") == "step_tool_result")
        if "건" in t and any(c.isdigit() for c in t) and not has_count_basis:
            return "날조전파"
        return "무해화"
    return "정상" if t and not t.endswith("하겠습니다.") else "이상"


async def main(n: int) -> None:
    r_model = "google/gemini-3.1-flash-lite"
    resp = Responder(get_messenger(r_model, base_url=OPENROUTER_BASE_URL), r_model)
    out = Path(__file__).parent / "results.jsonl"
    tally: dict[tuple, int] = {}
    for rep in range(n):
        for p in PROBES:
            r = None
            for attempt in range(3):  # Poolside 간헐 429 파도 — 20s 대기 재시도
                try:
                    r = await run_utterance(p["utterance"], role=p["role"],
                                            history=p.get("history"), log=False)
                    break
                except Exception as e:
                    if "429" not in str(e) or attempt == 2:
                        raise
                    print(f"  … 429 파도, 20s 대기 후 재시도 ({attempt+1}/2)", flush=True)
                    await asyncio.sleep(20)
            dialogue = [m for m in (p.get("history") or [])]
            for variant, system in (("현행", responder_mod.RESPONDER_SYSTEM),
                                    ("자료주도", DATA_DRIVEN_SYSTEM)):
                responder_mod.RESPONDER_SYSTEM = system
                text, _ = await resp.compose(
                    context_block="센터: 해오름 / 사용자: 김원장",
                    dialogue=dialogue, utterance=p["utterance"],
                    events=r.events, draft=r.final_text)
                verdict = _judge(p["id"], text, r.events)
                tally[(p["id"], variant, verdict)] = tally.get((p["id"], variant, verdict), 0) + 1
                with out.open("a") as f:
                    f.write(json.dumps({"probe": p["id"], "variant": variant,
                                        "verdict": verdict, "draft": r.final_text[:120],
                                        "final": text[:200]}, ensure_ascii=False) + "\n")
                print(f"[{rep+1}/{n}] {p['id']:<13} {variant:<4} → {verdict}", flush=True)
    print("\n=== 요약 (probe × variant → verdict) ===")
    for (pid, variant, verdict), c in sorted(tally.items()):
        print(f"{pid:<14} {variant:<5} {verdict:<6} {c}")


if __name__ == "__main__":
    asyncio.run(main(int(sys.argv[1]) if len(sys.argv) > 1 else 3))
