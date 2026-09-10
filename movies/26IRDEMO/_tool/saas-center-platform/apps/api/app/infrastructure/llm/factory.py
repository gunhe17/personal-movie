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
    # 로컬 촬영에서는 base_url로 대역을 끼운다(`_scripts/llm-stub.mjs`) — 비어 있으면 공식 API 그대로다.
    # 촬영 규칙 5와 같은 원칙: 제품 경로는 전부 진짜로 돌고 **모델 응답 한 홉만** 갈아 끼운다.
    base = getattr(settings, "OPENAI_BASE_URL", "") or None
    return OpenAIProvider(client=AsyncOpenAI(api_key=key, base_url=base), model=model)


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