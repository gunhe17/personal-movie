from __future__ import annotations

from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings
from app.infrastructure.llm.common.base import LLMProvider, timed
from app.infrastructure.llm.common.schemas import LLMResponse, Message, MessageRole


class OpenAIProvider(LLMProvider):
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
            await self._client.responses.create(
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


# Responses API codec — Message ↔ Responses 변환

def build_request(
    messages: list[Message], model: str, *,
    max_tokens: int, temperature: float, response_format: str | None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "model": model,
        "input": [_message_to_item(msg) for msg in messages],
        "temperature": temperature,
        "max_output_tokens": max_tokens,
    }
    if settings.COMPACT_THRESHOLD:
        kwargs["truncation"] = "auto"
    if response_format == "json":
        kwargs["text"] = {"format": {"type": "json_object"}}
        # Responses API는 input에 "json" 단어가 있어야 json_object 포맷을 허용한다
        input_items = kwargs["input"]
        if input_items and isinstance(input_items[-1], dict):
            last = input_items[-1]
            content = last.get("content", "")
            if isinstance(content, str) and "json" not in content.lower():
                last["content"] = content + "\nRespond in JSON."
    return kwargs


def _message_to_item(msg: Message) -> dict[str, Any]:
    role = "assistant" if msg.role == MessageRole.ASSISTANT else "user"
    return {"role": role, "content": msg.content or ""}


def parse(response: Any, model: str) -> LLMResponse:
    content: str | None = None
    for item in response.output:
        if item.type == "message":
            for part in item.content:
                if part.type == "output_text":
                    content = (content or "") + part.text
    return LLMResponse(
        content=content,
        input_tokens=response.usage.input_tokens if response.usage else None,
        output_tokens=response.usage.output_tokens if response.usage else None,
        model=response.model or model,
    )
