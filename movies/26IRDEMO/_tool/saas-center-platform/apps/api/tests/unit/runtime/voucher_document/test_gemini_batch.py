"""gemini_batch — 유닛 변환·청크·배치 폴링·run_stage 모드 분기 (네트워크 없음)."""
from __future__ import annotations

import json

import pytest

from app.runtime.voucher_document import batch_unit as bu
from app.runtime.voucher_document import gemini_batch as gb
from app.runtime.voucher_document.batch_unit import BatchUnit, UnitResult, run_stage
from app.runtime.voucher_document.gemini_batch import (
    _chunks,
    _parse_batch_response,
    run_units_batch,
    to_gemini_request,
)

_PNG_URI = "data:image/png;base64,aGVsbG8="


def _unit(key="0:g1", model="google/gemini-3-flash-preview", **kw):
    return BatchUnit(
        key=key, model=model,
        messages=[{"role": "system", "content": "시스템 지시"},
                  {"role": "user", "content": [
                      {"type": "image_url", "image_url": {"url": _PNG_URI}},
                      {"type": "text", "text": "추출하라"}]}],
        max_tokens=8000, temperature=1.0, reasoning={"effort": "low"},
        **{"response_format": {"type": "json_object"}, **kw},
    )


class TestConvert:
    def test_messages_to_gemini_request(self):
        req = to_gemini_request(_unit())
        assert req["systemInstruction"]["parts"] == [{"text": "시스템 지시"}]
        parts = req["contents"][0]["parts"]
        assert parts[0]["inline_data"] == {"mime_type": "image/png", "data": "aGVsbG8="}
        assert parts[1] == {"text": "추출하라"}
        gen = req["generationConfig"]
        assert gen["maxOutputTokens"] == 8000 and gen["temperature"] == 1.0
        assert gen["thinkingConfig"] == {"thinkingLevel": "low"}
        assert gen["responseMimeType"] == "application/json"                  # realtime 미러: 미지정=json_object 강제

    def test_text_response_format_disables_json(self):
        u = _unit(response_format={"type": "text"})
        gen = to_gemini_request(u)["generationConfig"]
        assert "responseMimeType" not in gen                                  # {"type":"text"} = JSON 강제 해제

    def test_json_schema_response_format(self):
        u = _unit(response_format={"type": "json_schema", "json_schema": {"schema": {"type": "object"}}})
        gen = to_gemini_request(u)["generationConfig"]
        assert gen["responseMimeType"] == "application/json"
        assert gen["responseJsonSchema"] == {"type": "object"}

    def test_chunks_respect_size_limit(self, monkeypatch):
        monkeypatch.setattr(gb, "CHUNK_LIMIT_BYTES", 1200)
        units = [_unit(key=f"{i}:g1") for i in range(4)]
        chunks = _chunks(units)
        assert len(chunks) > 1 and [u.key for c in chunks for u in c] == [u.key for u in units]


class TestParse:
    def test_parse_by_metadata_key_and_error_rows(self):
        units = [_unit(key="a"), _unit(key="b")]
        op = {"done": True, "response": {"inlinedResponses": {"inlinedResponses": [
            {"metadata": {"key": "b"}, "response": {
                "candidates": [{"content": {"parts": [{"text": '{"x":1}'}]}}],
                "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5}}},
            {"metadata": {"key": "a"}, "error": {"message": "quota"}},
        ]}}}
        out = _parse_batch_response(op, units)
        assert out["b"].ok and out["b"].content == '{"x":1}' and out["b"].input_tokens == 10
        assert not out["a"].ok and "quota" in out["a"].error

    def test_missing_rows_fail_explicitly(self):
        out = _parse_batch_response({"done": True, "response": {}}, [_unit(key="a")])
        assert not out["a"].ok and "누락" in out["a"].error


class _FakeResponse:
    def __init__(self, payload, status=200):
        self._payload, self.status_code, self.text = payload, status, json.dumps(payload)

    def json(self):
        return self._payload


class _FakeClient:
    """submit → operation name, poll: pending 1회 후 done."""

    def __init__(self):
        self.posted = []
        self.polls = 0

    async def post(self, url, params=None, json=None):
        self.posted.append(json)
        return _FakeResponse({"name": "batches/job1"})

    async def get(self, url, params=None):
        self.polls += 1
        if self.polls == 1:
            return _FakeResponse({"name": "batches/job1", "done": False})
        reqs = self.posted[0]["batch"]["input_config"]["requests"]["requests"]
        rows = [{"metadata": r["metadata"],
                 "response": {"candidates": [{"content": {"parts": [{"text": '{"ok":1}'}]}}]}}
                for r in reqs]
        return _FakeResponse({"done": True, "response": {"inlinedResponses": {"inlinedResponses": rows}}})


class TestRunBatch:
    @pytest.mark.asyncio
    async def test_submit_poll_and_map(self):
        units = [_unit(key="0:g1"), _unit(key="0:g2")]
        out = await run_units_batch(units, api_key="k", poll_interval=0.0, client=_FakeClient())
        assert set(out) == {"0:g1", "0:g2"} and all(r.ok for r in out.values())

    @pytest.mark.asyncio
    async def test_no_key_fails_explicitly(self, monkeypatch):
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        out = await run_units_batch([_unit(key="a")])
        assert not out["a"].ok and "GEMINI_API_KEY" in out["a"].error


class TestRunStageMode:
    @pytest.mark.asyncio
    async def test_batch_mode_partitions_by_model(self, monkeypatch):
        called = {}

        async def fake_batch(units, **kw):
            called["batch"] = [u.key for u in units]
            return {u.key: UnitResult(ok=True, content="{}") for u in units}

        async def fake_realtime(units, **kw):
            called["realtime"] = [u.key for u in units]
            return {u.key: UnitResult(ok=True, content="{}") for u in units}

        monkeypatch.setattr(gb, "run_units_batch", fake_batch)
        monkeypatch.setattr(bu, "run_stage_realtime", fake_realtime)
        units = [_unit(key="g"), _unit(key="s", model="anthropic/claude-sonnet-5")]
        out = await run_stage(units, ai_facade=None, ai_context=None, mode="batch")
        assert called["batch"] == ["g"] and called["realtime"] == ["s"] and set(out) == {"g", "s"}

    @pytest.mark.asyncio
    async def test_realtime_mode_default(self, monkeypatch):
        called = {}

        async def fake_realtime(units, **kw):
            called["realtime"] = [u.key for u in units]
            return {}

        monkeypatch.setattr(bu, "run_stage_realtime", fake_realtime)
        monkeypatch.delenv("VOUCHER_GEMINI_MODE", raising=False)
        await run_stage([_unit(key="g")], ai_facade=None, ai_context=None)
        assert called["realtime"] == ["g"]
