from __future__ import annotations

from openai import AsyncOpenAI

from app.core.config import settings
from app.infrastructure.llm.openai.client import OpenAIProvider
from app.infrastructure.llm.openrouter.chat_json import OpenRouterChatClient
from app.infrastructure.llm.openrouter.client import OPENROUTER_BASE_URL, OpenRouterProvider
from app.infrastructure.llm.openrouter.multimodal import OpenRouterMultimodalClient


def openai_client(model: str, *, api_key: str | None = None) -> OpenAIProvider:
    key = api_key or settings.OPENAI_API_KEY
    if not key:
        raise ValueError("OPENAI_API_KEY not set")
    return OpenAIProvider(client=AsyncOpenAI(api_key=key), model=model)


def openrouter_client(
    model: str,
    *,
    api_key: str | None = None,
) -> OpenRouterProvider:
    key = api_key or settings.OPENROUTER_API_KEY
    if not key:
        raise ValueError("OPENROUTER_API_KEY not set")
    return OpenRouterProvider(
        client=AsyncOpenAI(api_key=key, base_url=OPENROUTER_BASE_URL), model=model,
    )


def openrouter_multimodal_client(*, api_key: str | None = None) -> OpenRouterMultimodalClient:
    key = api_key or settings.OPENROUTER_API_KEY
    if not key:
        raise ValueError("OPENROUTER_API_KEY not set")
    return OpenRouterMultimodalClient(api_key=key)


def openrouter_chat_json_client(*, api_key: str | None = None) -> OpenRouterChatClient:
    key = api_key or settings.OPENROUTER_API_KEY
    if not key:
        raise ValueError("OPENROUTER_API_KEY not set")
    return OpenRouterChatClient(api_key=key)