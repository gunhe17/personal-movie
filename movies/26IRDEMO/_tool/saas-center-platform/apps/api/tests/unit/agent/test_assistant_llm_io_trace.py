"""LoopLLM 입출력 트레이스 — 순수 API request/response가 usage["io"]로 동봉되는 계약.
engine._record_usage가 이를 llm_calls.meta로 영속한다(2026-07-27 복원)."""

import pytest

from app.runtime.assistant.llm import LoopLLM


class _Usage:
    input_tokens = 10
    output_tokens = 5


class _Result:
    text = "안녕하세요"
    tool_uses = []
    stop_reason = "end_turn"
    usage = _Usage()
    latency_ms = 12.3
    model = "test-model"
    content = [{"type": "text", "text": "안녕하세요"}]


class _FakeMessenger:
    async def create(self, **kwargs):
        self.kwargs = kwargs
        return _Result()


@pytest.mark.asyncio
async def test_complete_attaches_pure_io():
    llm = LoopLLM(_FakeMessenger())
    turn = await llm.complete(
        system="SYS",
        items=[{"role": "user", "content": "질문"}],
        tools=[{"name": "t", "description": "d", "input_schema": {}}],
    )
    io = turn.usage["io"]
    assert io["request"]["messages"] == [{"role": "user", "content": "질문"}]
    assert io["request"]["system"][0]["text"] == "SYS"
    assert io["request"]["tools"][0]["name"] == "t"
    assert io["response"] == {
        "content": [{"type": "text", "text": "안녕하세요"}],
        "stop": "end",
    }
