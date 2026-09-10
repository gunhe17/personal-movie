from __future__ import annotations

from typing import Any

from openai import AsyncOpenAI

from app.infrastructure.llm.common.base import LLMProvider, timed
from app.infrastructure.llm.common.schemas import LLMResponse, Message, MessageRole

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

_ROLE = {
    MessageRole.SYSTEM: "system",
    MessageRole.USER: "user",
    MessageRole.ASSISTANT: "assistant",
}


class OpenRouterProvider(LLMProvider):
    def __init__(self, *, client: AsyncOpenAI, model: str) -> None:
        self._client = client
        self._model = model

    @timed
    async def chat(
        self,
        *,
        messages: list[Message],
        max_tokens: int = 4096,
        temperature: float = 0.0,
        response_format: str | None = None,
    ) -> LLMResponse:
        return parse(
            await self._client.chat.completions.create(
                **build_request(
                    messages,
                    self._model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    response_format=response_format,
                )
            ),
            self._model,
        )

    @timed
    async def quick(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        json: bool = False,
        max_tokens: int | None = None,
        temperature: float = 0.3,
    ) -> LLMResponse:
        return await self._complete(
            system_prompt,
            user_prompt,
            json=json,
            max_tokens=max_tokens,
            temperature=temperature,
        )


# Chat Completions codec — Message ↔ Chat Completions 변환

def build_request(
    messages: list[Message], model: str, *,
    max_tokens: int, temperature: float, response_format: str | None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": [{"role": _ROLE[m.role], "content": m.content or ""} for m in messages],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if response_format == "json":
        kwargs["response_format"] = {"type": "json_object"}
    return kwargs


def parse(response: Any, model: str) -> LLMResponse:
    return LLMResponse(
        content=response.choices[0].message.content,
        input_tokens=response.usage.prompt_tokens if response.usage else None,
        output_tokens=response.usage.completion_tokens if response.usage else None,
        model=response.model or model,
    )
