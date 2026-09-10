from __future__ import annotations

import functools
import time
from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from typing import Any

from app.core.config import settings
from app.infrastructure.llm.common.schemas import LLMResponse, Message


def timed(method: Callable[..., Awaitable[LLMResponse]]) -> Callable[..., Awaitable[LLMResponse]]:
    @functools.wraps(method)
    async def wrapper(*args: Any, **kwargs: Any) -> LLMResponse:
        start = time.perf_counter()
        result = await method(*args, **kwargs)
        result.latency_ms = (time.perf_counter() - start) * 1000
        return result

    return wrapper


class LLMProvider(ABC):
    _client: Any
    _model: str

    @abstractmethod
    async def chat(
        self, *, messages: list[Message],
        max_tokens: int = 4096, temperature: float = 0.0, response_format: str | None = None,
    ) -> LLMResponse: ...

    @abstractmethod
    async def quick(
        self, system_prompt: str, user_prompt: str, *,
        json: bool = False, max_tokens: int | None = None, temperature: float = 0.3,
    ) -> LLMResponse: ...

    def get_model_id(self) -> str:
        return self._model

    async def _complete(
        self, system_prompt: str, user_prompt: str, *,
        json: bool, max_tokens: int | None, temperature: float,
    ) -> LLMResponse:
        messages = (
            [{"role": "system", "content": system_prompt}] if system_prompt else []
        ) + [{"role": "user", "content": user_prompt}]
        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "max_tokens": max_tokens or settings.SUMMARY_MAX_TOKENS,
            "temperature": temperature,
        }
        if json:
            kwargs["response_format"] = {"type": "json_object"}

        r = await self._client.chat.completions.create(**kwargs)
        usage = r.usage
        return LLMResponse(
            content=(r.choices[0].message.content or "").strip(),
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
            model=r.model or self._model,
        )
