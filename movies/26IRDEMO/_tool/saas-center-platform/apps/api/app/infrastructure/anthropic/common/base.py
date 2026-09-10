from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.infrastructure.anthropic.common.schemas import MessageResult


class Messenger(ABC):
    _client: Any
    _model: str

    @abstractmethod
    async def create(
        self,
        *,
        messages: list[dict],
        system: str | list[dict] | None = None,
        tools: list[dict] | None = None,
        tool_choice: dict | None = None,
        max_tokens: int = 4096,
        effort: str = "high",
    ) -> MessageResult: ...

    def get_model_id(self) -> str:
        return self._model
