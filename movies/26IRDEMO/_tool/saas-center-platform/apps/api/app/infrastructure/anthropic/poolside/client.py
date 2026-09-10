"""Poolside 직결 메신저 — Anthropic wire ↔ OpenAI Chat Completions 번역.

번역은 이 파일이 유일 지점. 계약(knowledge/laguna-s-2.1/계약.md 경로 2):
thinking off가 구조화 tool_calls의 전제 — reasoning 플래그를
chat_template_kwargs.enable_thinking으로 전달(on이면 태그 문법이 content로 누출).
"""

from __future__ import annotations

import json
import time
from typing import Any

import httpx

from app.infrastructure.anthropic.common.base import Messenger
from app.infrastructure.anthropic.common.exception import AnthropicProviderError
from app.infrastructure.anthropic.common.schemas import MessageResult, ToolUse, Usage

_STOP = {
    "stop": "end_turn",
    "tool_calls": "tool_use",
    "length": "max_tokens",
    "content_filter": "refusal",
}
_TOOL_CHOICE = {"auto": "auto", "any": "required", "none": "none"}


def _key_pool() -> list[str]:
    """로테이션 풀(_1~3) — 소진(usage limit) 시 다음 키로 폴백. 빈 키 제외, 풀 미구성이면 빈 리스트.
    프로덕션 PROD 키는 이 풀 밖 — 실험(lab)이 PROD 한도를 건드리지 않게 격리(lab은 _1으로 시작)."""
    from app.core.config import settings

    return [k for k in (settings.POOLSIDE_API_KEY_1, settings.POOLSIDE_API_KEY_2,
                        settings.POOLSIDE_API_KEY_3) if k]


class PoolsideMessenger(Messenger):
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str,
    ) -> None:
        self._client = None  # Messenger 계약 필드 — 직결은 요청당 httpx 사용
        self._model = model
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

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
        payload = _to_openai(
            model=self._model,
            messages=messages,
            system=system,
            tools=tools,
            tool_choice=tool_choice,
            max_tokens=max_tokens,
            extra_body=extra_body,
        )
        start = time.perf_counter()
        # 키 후보열: 현재 키 → 풀의 나머지. "usage limit exceeded"(소진)에만 다음 키로 폴백,
        # 성공한 키는 settings에 되써서 이후 생성되는 메신저가 산 키로 시작한다.
        candidates = [self._api_key] + [k for k in _key_pool() if k != self._api_key]
        resp = None
        for i, key in enumerate(candidates):
            try:
                # ponytail: 요청당 커넥션 — 콜 1~3s 앞에서 TLS 셋업은 오차, 풀링은 병목 실측 시
                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.post(
                        f"{self._base_url}/chat/completions",
                        headers={"Authorization": f"Bearer {key}"},
                        json=payload,
                    )
            except httpx.HTTPError as e:
                raise AnthropicProviderError(
                    f"Poolside call failed (model={self._model}): {e}"
                ) from e
            exhausted = resp.status_code == 429 and "usage limit exceeded" in resp.text
            if exhausted and i + 1 < len(candidates):
                continue
            break
        if resp.status_code != 200:
            # 상태코드를 메시지에 포함 — 소비처 429 가드가 "429" 부분문자열로 감지
            raise AnthropicProviderError(
                f"Poolside call failed (model={self._model}): "
                f"{resp.status_code} - {resp.text[:300]}"
            )
        if key != self._api_key:
            from app.core.config import settings

            self._api_key = key
            settings.POOLSIDE_API_KEY = key
        latency_ms = (time.perf_counter() - start) * 1000
        return _to_result(resp.json(), self._model, latency_ms)

    async def create_stream(
        self,
        **kwargs: Any,
    ):
        """v1 논스트림 — 델타 없이 최종 result 1회(LoopLLM이 그대로 turn으로 소비)."""
        yield ("result", await self.create(**kwargs))


def _to_openai(
    *,
    model: str,
    messages: list[dict],
    system: str | list[dict] | None,
    tools: list[dict] | None,
    tool_choice: dict | None,
    max_tokens: int,
    extra_body: dict | None,
) -> dict[str, Any]:
    out: list[dict] = []
    if system:
        text = (
            system
            if isinstance(system, str)
            else "".join(b.get("text", "") for b in system)  # cache_control 마커 폐기
        )
        # system role은 크기 무관 tool 파서를 깨뜨린다(실측 2026-07-29: role 존재만으로
        # 태그 누출, 같은 user 메시지 접두는 function_results 날조). 별도 선행 user만 생존.
        out.append({"role": "user", "content": f"<system>\n{text}\n</system>"})
    for m in messages:
        out.extend(_msg(m))
    payload: dict[str, Any] = {
        "model": model,
        "messages": out,
        "max_tokens": max_tokens,
        "chat_template_kwargs": {
            "enable_thinking": bool(
                ((extra_body or {}).get("reasoning") or {}).get("enabled")
            )
        },
    }
    if tools:
        payload["tools"] = [
            {
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "parameters": t["input_schema"],
                },
            }
            for t in tools
        ]
        if tool_choice:
            kind = tool_choice.get("type")
            payload["tool_choice"] = (
                {"type": "function", "function": {"name": tool_choice["name"]}}
                if kind == "tool"
                else _TOOL_CHOICE.get(kind, "auto")
            )
    return payload


def _msg(m: dict) -> list[dict]:
    content = m["content"]
    if isinstance(content, str):
        return [{"role": m["role"], "content": content}]

    texts: list[str] = []
    tool_calls: list[dict] = []
    tool_results: list[dict] = []
    for b in content:
        kind = b.get("type")
        if kind == "text":
            texts.append(b["text"])
        elif kind == "tool_use":
            tool_calls.append(
                {
                    "id": b["id"],
                    "type": "function",
                    "function": {
                        "name": b["name"],
                        "arguments": json.dumps(
                            b.get("input") or {}, ensure_ascii=False
                        ),
                    },
                }
            )
        elif kind == "tool_result":
            c = b.get("content")
            tool_results.append(
                {
                    "role": "tool",
                    "tool_call_id": b["tool_use_id"],
                    "content": (
                        c
                        if isinstance(c, str)
                        else json.dumps(c, ensure_ascii=False, default=str)
                    ),
                }
            )

    if m["role"] == "assistant":
        msg: dict[str, Any] = {"role": "assistant", "content": "".join(texts) or None}
        if tool_calls:
            msg["tool_calls"] = tool_calls
        return [msg]
    # user: tool_result는 각각 role=tool 메시지(OpenAI 계약 — assistant tool_calls 직후)
    msgs: list[dict] = list(tool_results)
    if texts:
        msgs.append({"role": "user", "content": "".join(texts)})
    return msgs


def _to_result(
    data: dict,
    model: str,
    latency_ms: float,
) -> MessageResult:
    try:
        choice = data["choices"][0]
        msg = choice["message"]
    except (KeyError, IndexError) as e:
        raise AnthropicProviderError(
            f"Poolside malformed response: {json.dumps(data, ensure_ascii=False)[:300]}"
        ) from e

    text = msg.get("content") or ""
    tool_uses: list[ToolUse] = []
    content_blocks: list[dict] = []
    if text:
        content_blocks.append({"type": "text", "text": text})
    for tc in msg.get("tool_calls") or []:
        fn = tc.get("function") or {}
        try:
            args = json.loads(fn.get("arguments") or "{}")
        except json.JSONDecodeError:
            # 손상 인자는 사실로 통과 — 실행부 시그니처 검사가 모델에 피드백
            args = {"_raw": fn.get("arguments")}
        tool_uses.append(
            ToolUse(id=tc.get("id") or "", name=fn.get("name") or "", input=args)
        )
        content_blocks.append(
            {
                "type": "tool_use",
                "id": tc.get("id") or "",
                "name": fn.get("name") or "",
                "input": args,
            }
        )

    u = data.get("usage") or {}
    return MessageResult(
        text=text,
        stop_reason=_STOP.get(choice.get("finish_reason") or "", "end_turn"),
        usage=Usage(
            input_tokens=u.get("prompt_tokens", 0),
            output_tokens=u.get("completion_tokens", 0),
            cache_read_tokens=(u.get("prompt_tokens_details") or {}).get(
                "cached_tokens", 0
            )
            or 0,
            cache_write_tokens=0,
        ),
        tool_uses=tool_uses,
        model=data.get("model") or model,
        content=content_blocks,
        latency_ms=latency_ms,
    )


if __name__ == "__main__":
    payload = _to_openai(
        model="poolside/laguna-s-2.1",
        messages=[
            {"role": "user", "content": "<context>c</context>"},
            {
                "role": "assistant",
                "content": [
                    {"type": "text", "text": "조회합니다"},
                    {"type": "tool_use", "id": "t1", "name": "query_client",
                     "input": {"name": "김민준"}},
                ],
            },
            {
                "role": "user",
                "content": [
                    {"type": "tool_result", "tool_use_id": "t1",
                     "content": {"rows": [], "aggregate": {"count": 0}}}
                ],
            },
        ],
        system=[{"type": "text", "text": "SYS", "cache_control": {"type": "ephemeral"}}],
        tools=[{"name": "query_client", "description": "d", "input_schema": {"type": "object"}}],
        tool_choice={"type": "auto"},
        max_tokens=2048,
        extra_body={"reasoning": {"enabled": False}},
    )
    assert payload["messages"][0] == {"role": "user", "content": "<system>\nSYS\n</system>"}
    assert payload["messages"][2]["tool_calls"][0]["function"]["name"] == "query_client"
    assert payload["messages"][3]["role"] == "tool" and payload["messages"][3]["tool_call_id"] == "t1"
    assert payload["chat_template_kwargs"] == {"enable_thinking": False}
    assert payload["tool_choice"] == "auto"

    r = _to_result(
        {
            "choices": [{
                "finish_reason": "tool_calls",
                "message": {"content": None, "tool_calls": [{
                    "id": "c1", "type": "function",
                    "function": {"name": "query_client",
                                 "arguments": '{"name": "김민준"}'},
                }]},
            }],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5,
                      "prompt_tokens_details": {"cached_tokens": 8}},
        },
        "m", 1.0,
    )
    assert r.stop_reason == "tool_use" and r.tool_uses[0].input == {"name": "김민준"}
    assert r.usage.cache_read_tokens == 8 and r.content[0]["type"] == "tool_use"
    print("ok")
