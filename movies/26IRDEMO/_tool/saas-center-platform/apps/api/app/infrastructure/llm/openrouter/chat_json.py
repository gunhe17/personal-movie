"""OpenRouter 비스트리밍 JSON 모드 transport.

`openrouter/multimodal.py` (스트리밍 멀티모달) 와 별개로, 구조화 추출 단계에 맞춰 단순화:
- 비스트리밍 + JSON 응답
- 멀티파트 system content + cache_control 지원 (다수 병렬 호출에서 prompt caching 필수)
- HTTP 재시도 + 견고한 JSON 파싱 (코드 펜스/후행 콤마 허용)

`openrouter/client.py` 의 OpenRouterProvider 는 agent 도메인 Message 추상에 묶여
멀티파트 content + cache_control 을 지원하지 않아 그쪽을 확장하는 대신 별도 transport 로 둠.

순수 transport — quota 체크·사용량 기록은 AIGateway.generate_multimodal(stream=False)
이 소유 (.claude/rules/api/ai-calling.md). 소비처가 직접 생성하지 않는다.
"""
from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import dataclass

import httpx

from app.core.logger import get_logger

logger = get_logger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


@dataclass
class ChatJsonResult:
    ok: bool
    data: dict | None = None
    error: str | None = None
    raw: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    cached_tokens: int = 0  # prompt caching 으로 절감된 입력 토큰
    cost_usd: float = 0.0
    latency_ms: int = 0
    attempts: int = 1
    model: str = ""


class OpenRouterChatClient:
    """비스트리밍 JSON 모드 chat completions 호출 — cache_control 지원."""

    def __init__(
        self,
        api_key: str,
        *,
        referer: str = "https://github.com/saas-center-platform",
        title: str = "saas-center voucher extractor",
    ):
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY not set")
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": referer,
            "X-Title": title,
        }

    async def call_json(
        self,
        *,
        model: str,
        messages: list[dict],
        max_tokens: int = 4000,
        temperature: float = 0.0,
        reasoning: dict | None = None,
        response_format: dict | None = None,
        service_tier: str | None = None,
        timeout: float | None = 120.0,   # None = 무제한 (flex 배치)
        max_retries: int = 3,
    ) -> ChatJsonResult:
        """messages → JSON dict. 실패 시 ok=False. response_format 미지정 시 json_object."""
        payload = _build_payload(
            model, messages, max_tokens, temperature, reasoning, response_format, service_tier
        )

        last_error: str | None = None
        for attempt in range(1, max_retries + 1):
            t0 = time.perf_counter()
            try:
                async with httpx.AsyncClient(timeout=timeout) as http:
                    response = await http.post(
                        f"{OPENROUTER_BASE_URL}/chat/completions",
                        headers=self._headers,
                        json=payload,
                    )
                if response.status_code != 200:
                    last_error = (
                        f"HTTP {response.status_code}: "
                        f"{response.text[:300]}"
                    )
                    logger.warning(
                        "OpenRouterChat HTTP error (attempt %d/%d): %s",
                        attempt,
                        max_retries,
                        last_error[:200],
                    )
                else:
                    elapsed_ms = int((time.perf_counter() - t0) * 1000)
                    result, parse_err = _parse_response_body(
                        response.json(),
                        model=model, attempt=attempt, elapsed_ms=elapsed_ms,
                        require_json=(response_format or {}).get("type") != "text",
                    )
                    if result is not None:
                        return result
                    last_error = parse_err
                    logger.warning(
                        "OpenRouterChat JSON parse failed (attempt %d/%d): %s",
                        attempt, max_retries, (last_error or "")[:200],
                    )
            except (httpx.HTTPError, asyncio.TimeoutError) as e:
                last_error = f"{type(e).__name__}: {e}"
                logger.warning(
                    "OpenRouterChat network error (attempt %d/%d): %s",
                    attempt,
                    max_retries,
                    last_error[:200],
                )
            if attempt < max_retries:
                await asyncio.sleep(min(1.5 * attempt, 5.0))

        return ChatJsonResult(
            ok=False,
            error=last_error or "unknown",
            attempts=max_retries,
            model=model,
        )


# ── payload / response 변환 (순수) ──


def _build_payload(
    model: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    reasoning: dict | None = None,
    response_format: dict | None = None,
    service_tier: str | None = None,
) -> dict:
    """OpenRouter chat completions payload (JSON 모드 + usage 포함).

    response_format 미지정 = json_object(느슨). json_schema(strict) 지정 시 출력 형태를
    생성 시점에 강제한다 — 서식 그라운딩이 요소를 뭉치거나 빠뜨리는 붕괴 방지(lab 계약).
    {"type":"text"} 지정 = JSON 강제 해제(md 전사처럼 산문/HTML 이 정답인 호출).
    이때 응답은 파싱하지 않고 `raw` 로만 온다.
    service_tier="flex" = 여유 자원 등급(동일 품질, 지연 best-effort, 단가 −50%).
    """
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "response_format": response_format or {"type": "json_object"},
        "usage": {"include": True},  # OpenRouter: cost + cached_tokens 포함
    }
    if reasoning is not None:
        payload["reasoning"] = reasoning
    if service_tier is not None:
        payload["service_tier"] = service_tier
    return payload


def _parse_response_body(
    body: dict,
    *,
    model: str,
    attempt: int,
    elapsed_ms: int,
    require_json: bool = True,
) -> tuple[ChatJsonResult | None, str | None]:
    """HTTP 200 body → 성공 ChatJsonResult, 또는 (None, 파싱오류 메시지).

    require_json=False: 본문을 파싱하지 않고 `raw` 로만 돌려준다(`data` 는 None).
    response_format={"type":"text"} 인 호출(예: S1 md 전사)은 JSON 이 아닌 게 정상이다.
    """
    choices = body.get("choices") or [{}]
    content = (choices[0].get("message") or {}).get("content", "") or ""
    usage = body.get("usage", {}) or {}

    data = None
    if require_json:
        data, parse_err = _parse_json(content)
        if data is None:
            return None, f"JSON 파싱 실패: {parse_err}; raw[:200]={content[:200]!r}"

    cached = (usage.get("prompt_tokens_details") or {}).get("cached_tokens", 0) or 0
    return ChatJsonResult(
        ok=True,
        data=data,
        raw=content,
        input_tokens=int(usage.get("prompt_tokens", 0)),
        output_tokens=int(usage.get("completion_tokens", 0)),
        cached_tokens=int(cached),
        cost_usd=float(usage.get("cost", 0.0)),
        latency_ms=elapsed_ms,
        attempts=attempt,
        model=model,
    ), None


# ── JSON 파싱 견고화 (코드 펜스/후행 콤마/Extra data 허용) ──

_TRAILING_COMMA = re.compile(r",(\s*[}\]])")


def parse_json_lenient(content: str) -> tuple[dict | None, str | None]:
    """견고 JSON 파싱 공개 진입점 — 비-JSON-모드 응답(멀티모달 S3 등)에서 재사용."""
    return _parse_json(content)


def _parse_json(content: str) -> tuple[dict | None, str | None]:
    """순수 JSON / 코드 펜스 감싸짐 / 앞뒤 군더더기 / 후행 콤마를 모두 견디게 파싱.

    핵심은 첫 '{' 부터 raw_decode 로 첫 객체만 취하는 것 — 코드 펜스나 'Extra data'
    같은 앞뒤 군더더기를 자연스럽게 무시한다.
    """
    text = content.strip()
    err: str | None = None

    # 1) 그대로
    try:
        return json.loads(text), None
    except json.JSONDecodeError as e:
        err = str(e)

    s = text.find("{")
    if s == -1:
        return None, err

    # 2) 첫 { 부터 raw_decode (앞뒤 군더더기/펜스/Extra data 무시)
    try:
        return json.JSONDecoder().raw_decode(text[s:])[0], None
    except json.JSONDecodeError as e:
        err = str(e)

    # 3) 후행 콤마 제거 후 재시도 (',}' / ',]' → '}' / ']')
    try:
        return (
            json.JSONDecoder().raw_decode(_TRAILING_COMMA.sub(r"\1", text[s:]))[0],
            None,
        )
    except json.JSONDecodeError as e:
        err = str(e)

    return None, err
