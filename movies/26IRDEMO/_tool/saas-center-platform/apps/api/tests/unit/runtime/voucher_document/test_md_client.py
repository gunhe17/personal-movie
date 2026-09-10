"""OpenRouterChatClient.call_json + _parse_json characterization 테스트 (현재 동작 핀).

httpx.AsyncClient / asyncio.sleep 를 monkeypatch 해 재시도·파싱 오케스트레이션을 고정.
성공-파싱 블록(_parse_response_body) 추출이 결과/재시도 횟수를 바꾸지 않음을 보장하는 그물.
"""

import asyncio

import httpx
import pytest

from app.infrastructure.llm.openrouter import chat_json as cli
from app.infrastructure.llm.openrouter.chat_json import (
    OpenRouterChatClient,
    _parse_json,
)


# #
# 순수 JSON 파서

class TestParseJson:
    def test_plain(self):
        assert _parse_json('{"a": 1}') == ({"a": 1}, None)

    def test_code_fenced(self):
        assert _parse_json('```json\n{"a": 1}\n```') == ({"a": 1}, None)

    def test_surrounding_junk(self):
        assert _parse_json('설명 {"a": 1} 끝') == ({"a": 1}, None)

    def test_trailing_comma(self):
        assert _parse_json('{"a": 1,}') == ({"a": 1}, None)

    def test_no_object(self):
        data, err = _parse_json("json 아님")
        assert data is None
        assert err is not None


# #
# call_json — httpx mock 으로 재시도 흐름 고정

class _FakeResponse:
    def __init__(self, status_code, json_body=None, text=""):
        self.status_code = status_code
        self._json = json_body or {}
        self.text = text

    def json(self):
        return self._json


class _FakeAsyncClient:
    def __init__(self, queue):
        self._queue = queue

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, headers=None, json=None):
        item = self._queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def _ok_body(content='{"a": 1}'):
    return {
        "choices": [{"message": {"content": content}}],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "cost": 0.01,
            "prompt_tokens_details": {"cached_tokens": 3},
        },
    }


def _patch_http(mp, responses):
    queue = list(responses)
    mp.setattr(cli.httpx, "AsyncClient", lambda *a, **k: _FakeAsyncClient(queue))

    async def _nosleep(*a, **k):
        return None

    mp.setattr(cli.asyncio, "sleep", _nosleep)


async def _call(client):
    return await client.call_json(model="m", messages=[{"role": "user", "content": "x"}])


class TestCallJson:
    async def test_success_first_try(self, monkeypatch):
        _patch_http(monkeypatch, [_FakeResponse(200, _ok_body())])
        r = await _call(OpenRouterChatClient("key"))
        assert r.ok is True
        assert r.data == {"a": 1}
        assert (r.input_tokens, r.output_tokens, r.cached_tokens) == (10, 5, 3)
        assert r.cost_usd == 0.01
        assert r.attempts == 1

    async def test_retry_after_http_500(self, monkeypatch):
        _patch_http(monkeypatch, [
            _FakeResponse(500, text="boom"),
            _FakeResponse(200, _ok_body()),
        ])
        r = await _call(OpenRouterChatClient("key"))
        assert r.ok is True
        assert r.attempts == 2

    async def test_retry_after_parse_failure(self, monkeypatch):
        _patch_http(monkeypatch, [
            _FakeResponse(200, _ok_body(content="not json")),
            _FakeResponse(200, _ok_body()),
        ])
        r = await _call(OpenRouterChatClient("key"))
        assert r.ok is True
        assert r.attempts == 2

    async def test_all_network_errors_exhaust(self, monkeypatch):
        _patch_http(monkeypatch, [
            httpx.ConnectError("net1"),
            httpx.ConnectError("net2"),
            httpx.ConnectError("net3"),
        ])
        r = await _call(OpenRouterChatClient("key"))
        assert r.ok is False
        assert r.attempts == 3
        assert "ConnectError" in (r.error or "")

    async def test_all_http_errors_exhaust(self, monkeypatch):
        _patch_http(monkeypatch, [_FakeResponse(503, text="down")] * 3)
        r = await _call(OpenRouterChatClient("key"))
        assert r.ok is False
        assert r.attempts == 3
        assert (r.error or "").startswith("HTTP 503")
