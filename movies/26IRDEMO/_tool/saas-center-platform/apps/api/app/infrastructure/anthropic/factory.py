from __future__ import annotations

import re

from anthropic import AsyncAnthropic

from app.core.config import settings
from app.infrastructure.anthropic.common.base import Messenger
from app.infrastructure.anthropic.messages.client import AnthropicMessenger
from app.infrastructure.anthropic.poolside.client import PoolsideMessenger

# Anthropic SDK 그대로, 모델 호출만 OpenRouter로 보내는 경유지. SDK가 `{base_url}/v1/messages`로
# POST하므로 base는 `/api`까지만(OpenRouter가 Anthropic-compat /api/v1/messages를 서빙).
OPENROUTER_BASE_URL = "https://openrouter.ai/api"


def get_messenger(
    model: str,
    *,
    api_key: str | None = None,
    base_url: str | None = None,
) -> Messenger:
    # poolside/* = 직결 기본(전용 한도·tool_choice 유효 — 계약.md 경로 2). 킬스위치 POOLSIDE_DIRECT=false
    if (
        model.startswith("poolside/")
        and settings.POOLSIDE_DIRECT
        and settings.POOLSIDE_API_KEY
    ):
        return PoolsideMessenger(
            api_key=settings.POOLSIDE_API_KEY,
            model=model,
            base_url=settings.POOLSIDE_BASE_URL,
        )
    # base_url 명시(OpenRouter 경유) = OpenRouter 키. 미명시 = Anthropic 직접. (소비처가 정책 선택)
    if base_url:
        key = api_key or settings.OPENROUTER_API_KEY
        if not key:
            raise ValueError("OPENROUTER_API_KEY not set")
        client = AsyncAnthropic(api_key=key, base_url=base_url)
        return AnthropicMessenger(
            client=client, model=to_openrouter_model(model), via_openrouter=True
        )

    key = api_key or settings.ANTHROPIC_API_KEY
    if not key:
        raise ValueError("ANTHROPIC_API_KEY not set")
    return AnthropicMessenger(client=AsyncAnthropic(api_key=key), model=model)


def to_openrouter_model(model: str) -> str:
    # 내부 Anthropic ID → OpenRouter ID: `anthropic/` 접두 + 버전 표기 `4-5`→`4.5`.
    if "/" in model:  # 이미 provider 접두면 그대로
        return model
    return "anthropic/" + re.sub(r"-(\d+)-(\d+)$", r"-\1.\2", model)
