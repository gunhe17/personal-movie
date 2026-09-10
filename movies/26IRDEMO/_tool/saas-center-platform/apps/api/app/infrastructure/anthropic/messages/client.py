from __future__ import annotations

import time
from typing import Any

import anthropic
from anthropic import AsyncAnthropic

from app.infrastructure.anthropic.common.base import Messenger
from app.infrastructure.anthropic.common.exception import AnthropicProviderError
from app.infrastructure.anthropic.common.schemas import MessageResult, ToolUse, Usage


class AnthropicMessenger(Messenger):
    def __init__(
        self,
        *,
        client: AsyncAnthropic,
        model: str,
        via_openrouter: bool = False,
    ) -> None:
        self._client = client
        self._model = model
        self._via_openrouter = via_openrouter

    def _call_kwargs(
        self,
        *,
        messages: list[dict],
        system: str | list[dict] | None,
        tools: list[dict] | None,
        tool_choice: dict | None,
        max_tokens: int,
        effort: str,
        extra_body: dict | None,
    ) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "model": self._model,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        # adaptive thinking·effort는 Opus 4.6+/Sonnet 4.6/Fable 전용 — Haiku는 400.
        # OpenRouter 경유 시 Anthropic-native 파라미터는 미지원이라 생략.
        if not self._via_openrouter and "claude-haiku" not in self._model:
            kwargs["thinking"] = {"type": "adaptive"}
            kwargs["output_config"] = {"effort": effort}
        if system is not None:
            # cache_control은 Anthropic 전용 — OpenRouter 경유 비-Claude(Gemini 등)는 400 실측
            if self._via_openrouter and not self._model.startswith("anthropic/"):
                system = _strip_cache_control(system)
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = tools
        if tool_choice is not None:
            # tool_choice=any(강제 호출)는 OpenRouter 경유 Gemini에서 도구가 많으면 400(INVALID_ARGUMENT)
            # 실측(guard-any-toolchoice-400 E2) — 어차피 경유 시 강제가 무시돼 no-op이라 auto로 내려 400만 제거.
            if (
                self._via_openrouter
                and not self._model.startswith("anthropic/")
                and tool_choice.get("type") == "any"
            ):
                tool_choice = {"type": "auto"}
            kwargs["tool_choice"] = tool_choice
        if extra_body:
            kwargs["extra_body"] = (
                extra_body  # OpenRouter 전용 파라미터(reasoning 등) 통로
            )
        return kwargs

    async def create(
        self,
        *,
        messages: list[dict],
        system: str | list[dict] | None = None,
        tools: list[dict] | None = None,
        tool_choice: dict | None = None,
        max_tokens: int = 4096,
        effort: str = "high",
        extra_body: dict | None = None,
    ) -> MessageResult:
        kwargs = self._call_kwargs(
            messages=messages,
            system=system,
            tools=tools,
            tool_choice=tool_choice,
            max_tokens=max_tokens,
            effort=effort,
            extra_body=extra_body,
        )
        start = time.perf_counter()
        try:
            resp = await self._client.messages.create(**kwargs)
        except anthropic.AnthropicError as e:
            raise AnthropicProviderError(
                f"Anthropic call failed (model={self._model}): {e}"
            ) from e
        latency_ms = (time.perf_counter() - start) * 1000
        return _to_result(resp, self._model, latency_ms)

    async def create_stream(
        self,
        *,
        messages: list[dict],
        system: str | list[dict] | None = None,
        tools: list[dict] | None = None,
        tool_choice: dict | None = None,
        max_tokens: int = 4096,
        effort: str = "high",
        extra_body: dict | None = None,
    ):
        """텍스트 델타를 ("text", str)로 실시간 yield, 종료 시 ("result", MessageResult) 1회."""
        kwargs = self._call_kwargs(
            messages=messages,
            system=system,
            tools=tools,
            tool_choice=tool_choice,
            max_tokens=max_tokens,
            effort=effort,
            extra_body=extra_body,
        )
        start = time.perf_counter()
        try:
            async with self._client.messages.stream(**kwargs) as s:
                async for delta in s.text_stream:
                    if delta:
                        yield ("text", delta)
                resp = await s.get_final_message()
        except anthropic.AnthropicError as e:
            raise AnthropicProviderError(
                f"Anthropic stream failed (model={self._model}): {e}"
            ) from e
        latency_ms = (time.perf_counter() - start) * 1000
        yield ("result", _to_result(resp, self._model, latency_ms))


def _strip_cache_control(system: str | list[dict]) -> str | list[dict]:
    if isinstance(system, str):
        return system
    return [{k: v for k, v in block.items() if k != "cache_control"} for block in system]


def _to_result(resp: Any, model: str, latency_ms: float) -> MessageResult:
    text_parts: list[str] = []
    tool_uses: list[ToolUse] = []
    for block in resp.content:
        if block.type == "text":
            text_parts.append(block.text)
        elif block.type == "tool_use":
            tool_uses.append(
                ToolUse(id=block.id, name=block.name, input=dict(block.input))
            )

    u = resp.usage
    return MessageResult(
        text="".join(text_parts),
        stop_reason=resp.stop_reason,
        usage=Usage(
            input_tokens=u.input_tokens,
            output_tokens=u.output_tokens,
            cache_read_tokens=getattr(u, "cache_read_input_tokens", 0) or 0,
            cache_write_tokens=getattr(u, "cache_creation_input_tokens", 0) or 0,
        ),
        tool_uses=tool_uses,
        model=resp.model or model,
        content=list(resp.content),
        latency_ms=latency_ms,
    )


if __name__ == "__main__":
    from types import SimpleNamespace as NS

    fake = NS(
        content=[
            NS(type="text", text="hi "),
            NS(type="text", text="there"),
            NS(type="tool_use", id="tu1", name="get_accounts", input={"x": 1}),
        ],
        stop_reason="tool_use",
        usage=NS(
            input_tokens=10,
            output_tokens=5,
            cache_read_input_tokens=8,
            cache_creation_input_tokens=0,
        ),
        model="claude-opus-4-8",
    )
    r = _to_result(fake, "m", 1.0)
    assert r.text == "hi there", r.text
    assert r.stop_reason == "tool_use"
    assert len(r.tool_uses) == 1 and r.tool_uses[0].name == "get_accounts"
    assert r.usage.cache_read_tokens == 8 and r.usage.input_tokens == 10
    assert len(r.content) == 3
    print("ok")
