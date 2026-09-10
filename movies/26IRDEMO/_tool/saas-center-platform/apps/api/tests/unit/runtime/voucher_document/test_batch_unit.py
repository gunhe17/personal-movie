from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.runtime.voucher_document.batch_unit import BatchUnit, run_stage_realtime

from ._fakes import test_ctx


def _unit(key: str, **kw) -> BatchUnit:
    base = dict(key=key, model="google/gemini-3.1-flash-lite", messages=[
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "hello"},
    ], max_tokens=100, response_format={"type": "json_object"})
    base.update(kw)
    return BatchUnit(**base)


class TestRunStageRealtime:
    async def test_all_ok(self):
        ai_facade = AsyncMock()
        ai_facade.generate_multimodal.side_effect = [
            SimpleNamespace(ok=True, content="a"),
            SimpleNamespace(ok=True, content="b"),
        ]
        units = [_unit("k1"), _unit("k2")]

        results = await run_stage_realtime(units, ai_facade=ai_facade, ai_context=test_ctx())

        assert results["k1"].content == "a"
        assert results["k2"].content == "b"

    async def test_passes_unit_key_as_call_key(self):
        """usage 기록(meta.key)에서 몇 번 유닛(페이지)이었는지 알 수 있게 unit.key를 실어보낸다."""
        ai_facade = AsyncMock()
        ai_facade.generate_multimodal.return_value = SimpleNamespace(ok=True, content="a")

        await run_stage_realtime([_unit("p-007")], ai_facade=ai_facade, ai_context=test_ctx())

        assert ai_facade.generate_multimodal.await_args.kwargs["call_key"] == "p-007"

    async def test_partial_failure(self):
        ai_facade = AsyncMock()
        ai_facade.generate_multimodal.side_effect = [
            SimpleNamespace(ok=True, content="a"),
            SimpleNamespace(ok=False, content=None, error="boom"),
        ]
        units = [_unit("k1"), _unit("k2")]

        results = await run_stage_realtime(units, ai_facade=ai_facade, ai_context=test_ctx())

        assert results["k2"].ok is False
        assert results["k2"].error == "boom"

    async def test_flex_tier_for_gemini_only(self):
        # Gemini 계열은 flex(−50%), Llama(capture)는 flex endpoint 없어 표준.
        ai_facade = AsyncMock()
        ai_facade.generate_multimodal.return_value = SimpleNamespace(ok=True, content="a")

        await run_stage_realtime(
            [_unit("g", model="google/gemini-3.1-pro-preview")],
            ai_facade=ai_facade, ai_context=test_ctx(),
        )
        assert ai_facade.generate_multimodal.await_args.kwargs["service_tier"] == "flex"

        await run_stage_realtime(
            [_unit("l", model="meta-llama/llama-3.3-70b-instruct")],
            ai_facade=ai_facade, ai_context=test_ctx(),
        )
        assert ai_facade.generate_multimodal.await_args.kwargs["service_tier"] is None
