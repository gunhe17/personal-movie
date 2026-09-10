"""OpenRouterMultimodalClient.call characterization 테스트 (현재 동작 핀).

httpx streaming(stream/aiter_lines) 과 asyncio.sleep 를 monkeypatch 해
SSE 누적·usage·재시도 흐름을 고정. SSE 라인 파싱(_parse_sse_line) 추출이
content/usage/재시도 횟수를 바꾸지 않음을 보장하는 그물.
"""

import httpx
import pytest

from app.infrastructure.llm.openrouter import multimodal as cli
from app.infrastructure.llm.openrouter.multimodal import (
    OpenRouterMultimodalClient,
)


class _FakeStreamResponse:
    def __init__(self, status_code, lines=None, body=b""):
        self.status_code = status_code
        self._lines = lines or []
        self._body = body

    async def aread(self):
        return self._body

    async def aiter_lines(self):
        for ln in self._lines:
            yield ln


class _FakeStreamCtx:
    def __init__(self, response):
        self._r = response

    async def __aenter__(self):
        return self._r

    async def __aexit__(self, *a):
        return False


class _FakeAsyncClient:
    def __init__(self, queue):
        self._queue = queue

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    def stream(self, method, url, headers=None, json=None):
        item = self._queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return _FakeStreamCtx(item)


def _sse_token(text):
    return 'data: {"choices":[{"delta":{"content":"%s"}}]}' % text


_SSE_USAGE = (
    'data: {"usage":{"prompt_tokens":10,"completion_tokens":5,"cost":0.02}}'
)


def _patch(mp, responses):
    queue = list(responses)
    mp.setattr(cli.httpx, "AsyncClient", lambda *a, **k: _FakeAsyncClient(queue))

    async def _nosleep(*a, **k):
        return None

    mp.setattr(cli.asyncio, "sleep", _nosleep)


async def _call(client):
    return await client.call(model="m", messages=[{"role": "user", "content": "x"}])


class TestCall:
    async def test_success_accumulates_and_usage(self, monkeypatch):
        resp = _FakeStreamResponse(200, lines=[
            _sse_token("hel"), _sse_token("lo"), _SSE_USAGE, "data: [DONE]",
        ])
        _patch(monkeypatch, [resp])
        r = await _call(OpenRouterMultimodalClient("key"))
        assert r.ok is True
        assert r.content == "hello"
        assert (r.input_tokens, r.output_tokens) == (10, 5)
        assert r.cost_usd == 0.02
        assert r.attempts == 1
        assert r.cut_off is False

    async def test_skips_noise_lines(self, monkeypatch):
        resp = _FakeStreamResponse(200, lines=[
            "", ": keep-alive", "data: not-json", _sse_token("ok"), "data: [DONE]",
        ])
        _patch(monkeypatch, [resp])
        r = await _call(OpenRouterMultimodalClient("key"))
        assert r.ok is True
        assert r.content == "ok"

    async def test_http_error_then_success(self, monkeypatch):
        _patch(monkeypatch, [
            _FakeStreamResponse(500, body=b"boom"),
            _FakeStreamResponse(200, lines=[_sse_token("hi"), "data: [DONE]"]),
        ])
        r = await _call(OpenRouterMultimodalClient("key"))
        assert r.ok is True
        assert r.content == "hi"
        assert r.attempts == 2

    async def test_all_http_errors_exhaust(self, monkeypatch):
        _patch(monkeypatch, [_FakeStreamResponse(503, body=b"down")] * 3)
        r = await _call(OpenRouterMultimodalClient("key"))
        assert r.ok is False
        assert (r.error or "").startswith("HTTP 503")
        assert r.attempts == 3

    async def test_network_errors_exhaust(self, monkeypatch):
        _patch(monkeypatch, [httpx.ConnectError("n%d" % i) for i in range(3)])
        r = await _call(OpenRouterMultimodalClient("key"))
        assert r.ok is False
        assert "ConnectError" in (r.error or "")
        assert r.attempts == 3
