"""LoopLLM 어댑터 + wire 코덱 — provider가 스미는 유일한 곳 (이 파일 밖 "anthropic" 금지).

stop/usage 정규화 + cache_control 배치. 아이템은 처음부터 JSON-safe dict —
bookmark 재개 직렬화가 passthrough가 되도록. thinking 블록은 수정 없이 원본 보존.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any

from app.infrastructure.anthropic.common.base import Messenger
from app.infrastructure.anthropic.common.exception import AnthropicProviderError
from app.runtime.assistant.prompts import TurnInput

# Poolside 업스트림 간헐 429(같은 분에 성공·실패 공존) — SDK ~1초 재시도로 못 넘는 간격이라
# 폴백 안내로 접기 전 앱 레벨 1회만 더 기다린다
_RETRY_429_WAIT_S = 7


@dataclass(frozen=True)
class ToolCall:
    id: str
    name: str
    args: dict[str, Any]


@dataclass(frozen=True)
class AssistantLlmTurn:
    text: str
    tool_calls: list[ToolCall]
    stop: str  # "tool_use" | "end" | "max_tokens" | "refusal"
    usage: dict[str, Any]  # model/input_tokens/output_tokens/latency_ms
    raw_content: list[
        dict[str, Any]
    ]  # JSON-safe wire 블록 원본 (thinking 보존 — 재전송용)


@dataclass(frozen=True)
class ToolReturn:
    call_id: str
    content: Any  # str | list | dict
    is_error: bool = False


_STOP_MAP = {
    "tool_use": "tool_use",
    "end_turn": "end",
    "max_tokens": "max_tokens",
    "refusal": "refusal",
}

_TOOL_CHOICE = {
    "auto": {"type": "auto"},
    "none": {"type": "none"},
    "any": {"type": "any"},
}

# 서버측 tool search — defer된 도구를 모델이 자연어 질의로 발견한다 (검색·확장은 API가 수행)
_SEARCH_TOOL = {
    "type": "tool_search_tool_bm25_20251119",
    "name": "tool_search_tool_bm25",
}


def render(
    specs: list[Any],
    *,
    native_search: bool = True,
) -> list[dict[str, Any]]:
    """ToolSpec → provider tool 스키마. defer=True는 정의만 보내고 컨텍스트에는 검색 발견 시 실림.

    native_search=False(OpenRouter 경유): defer/bm25는 Anthropic 전용이라 provider가 거부 —
    전 도구를 평載한다(프리픽스 비용 상승은 감수, 기능 보존 우선. graph-driven-multihop 이식 공백).
    """
    tools: list[dict[str, Any]] = []
    for sp in specs:
        t: dict[str, Any] = {
            "name": sp.name,
            "description": sp.description,
            "input_schema": sp.input_schema,
        }
        if native_search and sp.defer:
            t["defer_loading"] = True
        tools.append(t)
    if native_search and any(sp.defer for sp in specs):
        tools.insert(0, _SEARCH_TOOL)
    return tools


class LoopLLM:
    def __init__(
        self,
        messenger: Messenger,
        *,
        reasoning: bool = False,
        max_tokens: int = 2048,
    ) -> None:
        # 기본 = reasoning off · 2048 (프로덕션 동결값). lab이 A/B로 override.
        self._messenger = messenger
        self._reasoning = reasoning
        self._max_tokens = max_tokens

    def _call_kwargs(
        self,
        *,
        system: str,
        items: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        tool_choice: str,
    ) -> dict[str, Any]:
        return {
            "messages": items,
            "system": [
                {
                    "type": "text",
                    "text": system,
                    "cache_control": {
                        "type": "ephemeral"
                    },  # tools+system이 함께 캐시됨
                }
            ],
            "tools": tools or None,
            "tool_choice": _TOOL_CHOICE[tool_choice] if tools else None,
            "max_tokens": self._max_tokens,
            # reasoning off = thinking이 max_tokens 소진하는 빈 답 글리치 레버(D10·D15). D1에서 A/B 중.
            "extra_body": {"reasoning": {"enabled": self._reasoning}},
        }

    async def complete(
        self,
        *,
        system: str,
        items: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        tool_choice: str = "auto",
    ) -> AssistantLlmTurn:
        kwargs = self._call_kwargs(
            system=system,
            items=items,
            tools=tools,
            tool_choice=tool_choice,
        )
        result = await self._messenger.create(**kwargs)
        return _attach_io(_to_turn(result), kwargs)

    async def complete_stream(
        self,
        *,
        system: str,
        items: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        tool_choice: str = "auto",
    ):
        """("delta", str)… 후 ("turn", AssistantLlmTurn) 1회.

        델타 방출 전 스트림 개시가 실패하면 논스트림으로 폴백(스트림 미지원 provider 방어).
        중간 실패는 그대로 raise — 폴백하면 이중 과금·중복 델타.
        """
        kwargs = self._call_kwargs(
            system=system,
            items=items,
            tools=tools,
            tool_choice=tool_choice,
        )
        emitted = False
        try:
            async for kind, payload in self._messenger.create_stream(**kwargs):
                if kind == "text":
                    emitted = True
                    yield ("delta", payload)
                else:
                    yield ("turn", _attach_io(_to_turn(payload), kwargs))
            return
        except Exception:
            if emitted:
                raise
        try:
            result = await self._messenger.create(**kwargs)
        except AnthropicProviderError as e:
            if "429" not in str(e):
                raise
            await asyncio.sleep(_RETRY_429_WAIT_S)
            result = await self._messenger.create(**kwargs)
        yield ("turn", _attach_io(_to_turn(result), kwargs))


def _attach_io(
    turn: AssistantLlmTurn,
    kwargs: dict[str, Any],
) -> AssistantLlmTurn:
    """순수 API 입출력을 usage에 동봉 — engine이 llm_calls.meta로 영속(record_agent_call)."""
    turn.usage["io"] = {
        "request": json.loads(json.dumps(kwargs, ensure_ascii=False, default=str)),
        "response": {"content": turn.raw_content, "stop": turn.stop},
    }
    return turn


def _to_turn(result: Any) -> AssistantLlmTurn:
    return AssistantLlmTurn(
        text=result.text,
        tool_calls=[
            ToolCall(id=t.id, name=t.name, args=dict(t.input)) for t in result.tool_uses
        ],
        stop=_STOP_MAP.get(result.stop_reason or "", "end"),
        usage={
            "model": result.model,
            "input_tokens": result.usage.input_tokens,
            "output_tokens": result.usage.output_tokens,
            "latency_ms": result.latency_ms or 0.0,
        },
        raw_content=[_to_json_safe(b) for b in result.content],
    )


def _to_json_safe(block: Any) -> dict[str, Any]:
    if isinstance(block, dict):
        return block
    if hasattr(block, "model_dump"):
        return block.model_dump()
    return dict(block.__dict__)


# #
# wire 코덱 — 순수 함수, DB 로드는 context 소유


def initial_items(
    turn_input: TurnInput,
    *,
    user_message: str,
) -> list[dict[str, Any]]:
    """컨텍스트 블록(캐시 경계 뒤) + 지난 완주 턴들 + 이번 사용자 메시지."""
    items: list[dict[str, Any]] = []
    if turn_input.bundle.context_block:
        items.append(
            {
                "role": "user",
                "content": f"<context>\n{turn_input.bundle.context_block}\n</context>",
            }
        )
    items.extend(
        {"role": m["role"], "content": m["content"]} for m in turn_input.history
    )
    items.append({"role": "user", "content": user_message})
    return items


def append_assistant(
    items: list[dict[str, Any]],
    turn: AssistantLlmTurn,
) -> None:
    items.append({"role": "assistant", "content": turn.raw_content})


def append_tool_results(
    items: list[dict[str, Any]],
    returns: list[ToolReturn],
) -> None:
    """한 assistant 턴의 모든 tool_use에 대한 결과를 user 메시지 하나로."""
    items.append(
        {
            "role": "user",
            "content": [_tool_result_block(r) for r in returns],
        }
    )


def append_user_text(
    items: list[dict[str, Any]],
    text: str,
) -> None:
    items.append({"role": "user", "content": text})


def serialize(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return json.loads(json.dumps(items, ensure_ascii=False, default=str))


def _tool_result_block(r: ToolReturn) -> dict[str, Any]:
    content = (
        r.content
        if isinstance(r.content, str)
        else json.dumps(r.content, ensure_ascii=False, default=str)
    )
    block: dict[str, Any] = {
        "type": "tool_result",
        "tool_use_id": r.call_id,
        "content": content,
    }
    if r.is_error:
        block["is_error"] = True
    return block
