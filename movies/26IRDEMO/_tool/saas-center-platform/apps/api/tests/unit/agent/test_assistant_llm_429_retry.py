"""429 앱 레벨 재시도 — 폴백 안내로 접기 전 7초 대기 후 1회 재시도(간헐 용량 거부 흡수).
스트림 개시 실패는 논스트림 폴백으로 떨어지므로 그 지점 하나가 전 경로를 덮는다."""

from app.infrastructure.anthropic.common.exception import AnthropicProviderError
from app.runtime.assistant import llm as llm_mod
from app.runtime.assistant.llm import LoopLLM


class _Usage:
    input_tokens = 10
    output_tokens = 5


class _Result:
    text = "3건입니다"
    tool_uses = []
    stop_reason = "end_turn"
    usage = _Usage()
    latency_ms = 12.3
    model = "test-model"
    content = [{"type": "text", "text": "3건입니다"}]


class _Messenger429Once:
    def __init__(
        self,
        error: Exception,
    ):
        self.error = error
        self.create_calls = 0

    async def create_stream(self, **kwargs):
        raise self.error
        yield  # pragma: no cover

    async def create(self, **kwargs):
        self.create_calls += 1
        if self.create_calls == 1:
            raise self.error
        return _Result()


async def _run_stream(llm: LoopLLM):
    return [
        step
        async for step in llm.complete_stream(
            system="SYS", items=[{"role": "user", "content": "질문"}], tools=[]
        )
    ]


async def test_429_waits_and_retries_once(monkeypatch):
    monkeypatch.setattr(llm_mod, "_RETRY_429_WAIT_S", 0)
    messenger = _Messenger429Once(AnthropicProviderError("upstream 429 rate limit"))
    steps = await _run_stream(LoopLLM(messenger))
    assert messenger.create_calls == 2
    assert steps[-1][0] == "turn" and steps[-1][1].text == "3건입니다"


async def test_non_429_provider_error_raises_without_retry(monkeypatch):
    monkeypatch.setattr(llm_mod, "_RETRY_429_WAIT_S", 0)
    messenger = _Messenger429Once(AnthropicProviderError("upstream 500"))
    try:
        await _run_stream(LoopLLM(messenger))
        raise AssertionError("expected AnthropicProviderError")
    except AnthropicProviderError:
        pass
    assert messenger.create_calls == 1
