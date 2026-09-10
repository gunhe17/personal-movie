"""assistant 스트림 E2E — HTTP → behavior → engine → loop → executor → SSE 전 경로.

LLM만 스크립트 스텁(실모델 행동은 labs/prod_lab 소관 — 여기는 배선 검증):
엔진 소실 회귀(_record_usage AttributeError 실사고)와 히스토리 도구 흔적 복원
(history-tool-trace-plan.md)이 HTTP 경계에서 도는지 본다.
"""
import json

import pytest

from app.runtime.assistant import engine as engine_mod
from app.runtime.assistant.llm import AssistantLlmTurn, ToolCall


class ScriptedLLM:
    """호출 순서대로 각본 소비. 받은 items를 기록해 히스토리 형태를 검증하게 한다."""

    def __init__(
        self,
        script,
    ):
        self.script = list(script)
        self.seen_items = []

    async def complete_stream(
        self,
        *,
        system,
        items,
        tools,
        tool_choice="auto",
    ):
        self.seen_items.append([dict(m) for m in items])
        turn = self.script.pop(0)
        if turn.text:
            yield ("delta", turn.text)
        yield ("turn", turn)


def _turn(
    text="",
    calls=(),
):
    return AssistantLlmTurn(
        text=text,
        tool_calls=[ToolCall(id=f"tc{i}", name=n, args=a) for i, (n, a) in enumerate(calls)],
        stop="tool_use" if calls else "end",
        usage={"model": "scripted", "input_tokens": 1, "output_tokens": 1, "latency_ms": 0.0},
        raw_content=[],
    )


async def _stream_turn(
    api,
    headers,
    center_id,
    conversation_id,
    message,
):
    events = []
    async with api.stream(
        "POST",
        f"/api/v1/centers/{center_id}/assistant/conversations/{conversation_id}/stream",
        json={"message": message},
        headers=headers,
    ) as r:
        assert r.status_code == 200, await r.aread()
        async for line in r.aiter_lines():
            if not line.startswith("data: ") or line == "data: [DONE]":
                continue
            events.append(json.loads(line[len("data: "):]))
    return events


@pytest.fixture
def scripted_llm(monkeypatch):
    def install(script):
        llm = ScriptedLLM(script)
        monkeypatch.setattr(engine_mod, "_default_llm", lambda: llm)
        return llm

    return install


async def test_assistant_stream_two_turns_with_tool_trace_history(
    api,
    manager,
    scripted_llm,
):
    center_id = manager["center_id"]
    headers = manager["headers"]

    r = await api.post(
        f"/api/v1/centers/{center_id}/assistant/conversations",
        json={}, headers=headers,
    )
    assert r.status_code == 200, r.text
    conversation_id = r.json()["id"]

    # 턴 1: 조회 1회 → 최종답
    llm = scripted_llm([
        _turn(calls=[("query_member_handler", {"fields": ["name", "role_code"]})]),
        _turn(text="재직 중인 직원 목록입니다."),
    ])
    events = await _stream_turn(api, headers, center_id, conversation_id, "직원 명단 보여줘")

    kinds = [e["type"] for e in events]
    assert "step_tool_result" in kinds and "conversation_done" in kinds
    tool_ev = next(e for e in events if e["type"] == "step_tool_result")
    assert tool_ev["tool"] == "query_member_handler"
    assert isinstance(tool_ev["output"], list) and tool_ev["output"]
    assert events[-1]["message"] == "재직 중인 직원 목록입니다."

    # 턴 2: 같은 대화 — 엔진이 재구성한 히스토리에 턴 1의 도구 흔적 블록이 실려야 한다
    llm = scripted_llm([
        _turn(calls=[("query_client_handler", {"fields": ["name"]})]),
        _turn(text="내담자 목록입니다."),
    ])
    events = await _stream_turn(api, headers, center_id, conversation_id, "내담자 목록 보여줘")
    assert events[-1]["type"] == "conversation_done"

    first_call_items = llm.seen_items[0]
    tool_uses = [
        b for m in first_call_items if isinstance(m["content"], list)
        for b in m["content"] if b.get("type") == "tool_use"
    ]
    tool_results = [
        b for m in first_call_items if isinstance(m["content"], list)
        for b in m["content"] if b.get("type") == "tool_result"
    ]
    assert tool_uses and tool_uses[0]["name"] == "query_member_handler", "히스토리에 지난 턴 tool_use 흔적 없음"
    assert tool_results and "returned_rows" in tool_results[0]["content"], "히스토리에 tool_result 절삭 요약 없음"
