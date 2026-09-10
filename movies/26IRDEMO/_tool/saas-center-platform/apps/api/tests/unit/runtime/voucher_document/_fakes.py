"""voucher_document 유닛테스트 공용 페이크 — AIGateway duck-type."""
from __future__ import annotations

import json

from app.infrastructure.llm.openrouter.chat_json import ChatJsonResult
from app.infrastructure.llm.openrouter.multimodal import OpenRouterCallResult
from app.modules.llm.gateway.schemas import AICallContext


def test_ctx(purpose: str = "voucher_md_to_json") -> AICallContext:
    return AICallContext(center_id="", source_type="test", purpose=purpose)


def chat_ok(data: dict, **kw) -> ChatJsonResult:
    # raw = data 의 JSON 문자열 — run_stage_realtime 은 .raw(원문)을 읽어 자체 파싱한다.
    base = dict(ok=True, data=data, raw=json.dumps(data, ensure_ascii=False),
                input_tokens=10, output_tokens=5, cost_usd=0.001, latency_ms=20)
    base.update(kw)
    return ChatJsonResult(**base)


def chat_fail(error: str = "boom") -> ChatJsonResult:
    return ChatJsonResult(ok=False, error=error)


def mm_ok(content: str, **kw) -> OpenRouterCallResult:
    base = dict(ok=True, content=content, input_tokens=10, output_tokens=5,
                cost_usd=0.001, latency_ms=20)
    base.update(kw)
    return OpenRouterCallResult(**base)


def mm_fail(error: str = "boom") -> OpenRouterCallResult:
    return OpenRouterCallResult(ok=False, error=error)


class FakeAIGateway:
    """AIGateway duck-type — generate_multimodal 이 준비된 응답을 순서대로 반환."""

    def __init__(
        self,
        responses: list,
    ):
        self._responses = list(responses)
        self.calls: list[dict] = []

    async def generate_multimodal(
        self,
        ctx,
        *,
        model,
        messages,
        **kw,
    ):
        self.calls.append({"model": model, "messages": messages, **kw})
        return self._responses.pop(0)
