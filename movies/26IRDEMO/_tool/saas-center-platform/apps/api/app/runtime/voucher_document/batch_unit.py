"""스테이지 실행 추상화 — "독립 LLM 호출 여러 개 → key 매핑 결과".

전 스테이지(S1·S2·S3·밀집3필드)가 이 한 모양을 공유한다. 실행 모드는 둘(사용자 결정 2026-08-31,
이전 "Google 네이티브 batch 폐기" 결정을 뒤집음 — P10-c):
  realtime(기본) = OpenRouter 실시간 병렬, gemini 유닛은 flex 등급(−50%·지연 best-effort).
  batch = gemini 유닛만 Google Gemini Batch API(직결 키, 단가 50%)로 제출·폴링, 그 외 모델은
          realtime 유지. `VOUCHER_GEMINI_MODE=batch` 또는 run_stage(mode="batch")로 선택.
"""
from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass

from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext


@dataclass(frozen=True)
class BatchUnit:
    key: str
    model: str
    messages: list[dict]
    max_tokens: int
    # 필수 — 출력 형식 선언: {"type":"json_object"}(구조 추출) / {"type":"text"}(산문·전사) /
    # {"type":"json_schema","json_schema":{...}}(strict 스키마). 기본값 없음: 숨은 json_object
    # 강제가 전사 md 를 침묵 오염시킨 실측(2026-08-31) 후 생성 시점 선언을 강제한다.
    response_format: dict
    temperature: float = 0.0
    reasoning: dict | None = None


@dataclass
class UnitResult:
    ok: bool
    content: str | None = None
    error: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: int = 0


async def run_stage_realtime(
    units: list[BatchUnit],
    *,
    ai_facade: AIFacade,
    ai_context: AICallContext,
    concurrency: int = 6,
    flex: bool = True,
) -> dict[str, UnitResult]:
    """units → 실시간 병렬 실행 → {key: UnitResult}.

    flex=True(기본): Gemini 유닛은 flex 등급(−50%·지연 best-effort)으로. flex=False면
    지연·신뢰성이 중요한 스테이지(예: 서식 추출)를 표준 등급으로 고정.
    """
    sem = asyncio.Semaphore(max(1, concurrency))

    async def _one(unit: BatchUnit) -> tuple[str, UnitResult]:
        # flex endpoint 는 Gemini(google/*)만. Llama(capture)엔 없음.
        service_tier = "flex" if (flex and unit.model.startswith("google/")) else None
        async with sem:
            call = await ai_facade.generate_multimodal(
                ai_context,
                stream=False,
                model=unit.model,
                messages=unit.messages,
                max_tokens=unit.max_tokens,
                temperature=unit.temperature,
                call_key=unit.key,
                reasoning=unit.reasoning,
                response_format=unit.response_format,
                service_tier=service_tier,
            )
        ok = bool(getattr(call, "ok", False))
        # generate_multimodal(stream=False) → ChatJsonResult(.raw) / stream=True → OpenRouterCallResult(.content)
        content = (getattr(call, "content", None) or getattr(call, "raw", None)) if ok else None
        error = None if ok else (getattr(call, "error", None) or "unknown")
        return unit.key, UnitResult(
            ok=ok,
            content=content,
            error=error,
            input_tokens=int(getattr(call, "input_tokens", 0) or 0),
            output_tokens=int(getattr(call, "output_tokens", 0) or 0),
            cost_usd=float(getattr(call, "cost_usd", 0) or 0),
            latency_ms=int(getattr(call, "latency_ms", 0) or 0),
        )

    pairs = await asyncio.gather(*(_one(u) for u in units))
    return dict(pairs)


def gemini_mode() -> str:
    """스테이지 gemini 실행 모드 — "realtime"(기본) | "batch" (환경변수 VOUCHER_GEMINI_MODE)."""
    return os.environ.get("VOUCHER_GEMINI_MODE", "realtime")


async def run_stage(
    units: list[BatchUnit],
    *,
    ai_facade: AIFacade,
    ai_context: AICallContext,
    concurrency: int = 6,
    flex: bool = True,
    mode: str | None = None,
) -> dict[str, UnitResult]:
    """모드 분기 실행 — batch 면 gemini(google/*) 유닛만 Gemini Batch API, 나머지는 realtime."""
    mode = mode or gemini_mode()
    gem = [u for u in units if u.model.startswith("google/")]
    if mode != "batch" or not gem:
        return await run_stage_realtime(units, ai_facade=ai_facade, ai_context=ai_context,
                                        concurrency=concurrency, flex=flex)
    from app.runtime.voucher_document.gemini_batch import run_units_batch
    rest = [u for u in units if not u.model.startswith("google/")]
    out: dict[str, UnitResult] = {}
    if rest:
        out.update(await run_stage_realtime(rest, ai_facade=ai_facade, ai_context=ai_context,
                                            concurrency=concurrency, flex=flex))
    out.update(await run_units_batch(gem))
    return out
