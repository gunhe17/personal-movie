"""OpenRouter 멀티모달 SSE transport (text + image_url 블록).

`openrouter/client.py` 의 OpenRouterProvider 는 agent 도메인의 `Message` 추상에
묶여 multimodal content 를 지원하지 않는다. 이 모듈은 OpenRouter Chat Completions
SSE 를 httpx 로 직접 호출한다.

핵심 기능:
- 스트리밍 + 클라이언트 측 cutoff (서버 모델 생성 중단 → 비용 절감)
- 최대 max_retries 회 재시도
- usage.include (OpenRouter 확장) 로 cost 추적
- stop sequence 로 무한 반복 방지

순수 transport — quota 체크·사용량 기록은 AIGateway.generate_multimodal 이 소유
(.claude/rules/api/ai-calling.md). 소비처가 직접 생성하지 않는다.
"""
from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass

import httpx

from app.core.logger import get_logger

logger = get_logger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


@dataclass
class OpenRouterCallResult:
    ok: bool
    content: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: int = 0
    cut_off: bool = False
    attempts: int = 1
    error: str | None = None
    model: str = ""


class OpenRouterMultimodalClient:
    """OpenRouter Chat Completions SSE 멀티모달 호출.

    messages 의 content 는 [{"type": "text", ...}, {"type": "image_url", ...}]
    형태의 list 를 허용 (OpenAI 호환 멀티모달 schema).
    """

    def __init__(
        self,
        api_key: str,
        *,
        referer: str = "https://github.com/saas-center-platform",
        title: str = "saas-center voucher converter",
    ):
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY not set")
        self._api_key = api_key
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": referer,
            "X-Title": title,
        }

    async def call(
        self,
        *,
        model: str,
        messages: list[dict],
        max_tokens: int = 64000,
        temperature: float = 0.1,
        response_format: dict | None = None,
        stop: list[str] | None = None,
        reasoning: dict | None = None,
        cutoff_seconds: float = 60.0,
        max_retries: int = 3,
    ) -> OpenRouterCallResult:
        """SSE streaming 호출 — cutoff 초과 시 연결 close 하여 서버 모델 중단."""
        payload = _build_payload(
            model,
            messages,
            max_tokens,
            temperature,
            response_format,
            stop,
            reasoning,
        )

        last_error: str | None = None
        for attempt in range(1, max_retries + 1):
            t0 = time.perf_counter()
            accumulated = ""
            usage: dict = {}
            cut_off = False
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(
                        connect=15.0,
                        read=cutoff_seconds + 30,
                        write=30.0,
                        pool=10.0,
                    )
                ) as http:
                    async with http.stream(
                        "POST",
                        f"{OPENROUTER_BASE_URL}/chat/completions",
                        headers=self._headers,
                        json=payload,
                    ) as response:
                        if response.status_code != 200:
                            body = await response.aread()
                            last_error = (
                                f"HTTP {response.status_code}: "
                                f"{body.decode(errors='ignore')[:300]}"
                            )
                            logger.warning(
                                "OpenRouter call failed (attempt %d/%d): %s",
                                attempt,
                                max_retries,
                                last_error[:200],
                            )
                            if attempt < max_retries:
                                await asyncio.sleep(min(2 * attempt, 5))
                                continue
                            return OpenRouterCallResult(
                                ok=False,
                                error=last_error,
                                attempts=attempt,
                                model=model,
                            )

                        async for raw_line in response.aiter_lines():
                            if (time.perf_counter() - t0) > cutoff_seconds:
                                cut_off = True
                                break
                            token, line_usage, done = _parse_sse_line(raw_line)
                            if done:
                                break
                            if token:
                                accumulated += token
                            if line_usage:
                                usage = line_usage

                latency_ms = int((time.perf_counter() - t0) * 1000)
                if cut_off:
                    logger.warning(
                        "OpenRouter cutoff %.1fs (received %d chars, attempt %d/%d)",
                        cutoff_seconds,
                        len(accumulated),
                        attempt,
                        max_retries,
                    )
                    last_error = f"client cutoff at {cutoff_seconds}s"
                    if attempt < max_retries:
                        await asyncio.sleep(min(2 * attempt, 5))
                        continue
                    # 마지막 시도라도 accumulated 가 있으면 살려서 반환
                    # (caller 가 parser 로 부분 복구 시도)
                return _success_result(
                    accumulated, usage,
                    model=model, attempt=attempt,
                    cut_off=cut_off, latency_ms=latency_ms,
                )
            except (httpx.HTTPError, asyncio.TimeoutError) as e:
                elapsed = time.perf_counter() - t0
                last_error = f"{type(e).__name__}: {e}"
                logger.warning(
                    "OpenRouter network error %.1fs (attempt %d/%d): %s",
                    elapsed,
                    attempt,
                    max_retries,
                    last_error[:200],
                )
                if attempt < max_retries:
                    await asyncio.sleep(min(2 * attempt, 5))
                    continue

        return OpenRouterCallResult(
            ok=False,
            error=last_error or "unknown",
            attempts=max_retries,
            model=model,
        )


# ── payload / SSE / result 변환 (순수) ──


def _build_payload(
    model: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    response_format: dict | None,
    stop: list[str] | None,
    reasoning: dict | None = None,
) -> dict:
    """OpenRouter SSE chat 페이로드 (stream + usage 포함)."""
    payload: dict = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": True,
        "stream_options": {"include_usage": True},
        "usage": {"include": True},  # OpenRouter 확장: cost 포함
    }
    if response_format is not None:
        payload["response_format"] = response_format
    if stop:
        payload["stop"] = stop
    if reasoning is not None:
        payload["reasoning"] = reasoning
    return payload


def _parse_sse_line(raw_line: str) -> tuple[str, dict | None, bool]:
    """SSE 한 줄 → (token, usage, done).

    data 라인이 아니거나 JSON 파싱 실패면 ("", None, False), `[DONE]` 이면 done=True.
    """
    line = raw_line.strip()
    if not line or not line.startswith("data: "):
        return "", None, False
    payload_str = line[6:]
    if payload_str == "[DONE]":
        return "", None, True
    try:
        chunk = json.loads(payload_str)
    except json.JSONDecodeError:
        return "", None, False
    token = ""
    choices = chunk.get("choices") or []
    if choices:
        delta = choices[0].get("delta") or {}
        token = delta.get("content") or ""
    return token, (chunk.get("usage") or None), False


def _success_result(
    accumulated: str,
    usage: dict,
    *,
    model: str,
    attempt: int,
    cut_off: bool,
    latency_ms: int,
) -> OpenRouterCallResult:
    """누적 content + usage → 성공 OpenRouterCallResult."""
    return OpenRouterCallResult(
        ok=True,
        content=accumulated,
        input_tokens=int(usage.get("prompt_tokens", 0)),
        output_tokens=int(usage.get("completion_tokens", 0)),
        cost_usd=float(usage.get("cost", 0.0)),
        latency_ms=latency_ms,
        cut_off=cut_off,
        attempts=attempt,
        model=model,
    )
