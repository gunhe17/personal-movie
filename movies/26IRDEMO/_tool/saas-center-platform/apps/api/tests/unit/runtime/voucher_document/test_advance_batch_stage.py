"""advance_batch_stage_if_ready — progress.stage → runner.STAGE_FUNCS 디스패치.

실제 스테이지 함수(runner.py, storage/PDF 필요)는 안 태우고 `STAGE_FUNCS`를
가짜 함수로 monkeypatch — 이 파일은 오직 "디스패치·실패 처리" 계약만 본다.
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.runtime.voucher_document.extract_job import advance_batch_stage
from app.core.exceptions import InvalidOperationException


def _extraction(progress: dict | None) -> SimpleNamespace:
    return SimpleNamespace(id="ex-1", progress=progress)


async def test_no_stage_is_noop():
    ai_facade = AsyncMock()
    voucher_facade = AsyncMock()
    gdoc_facade = AsyncMock()
    storage = AsyncMock()

    await advance_batch_stage.advance_batch_stage_if_ready(
        ai_facade=ai_facade, voucher_facade=voucher_facade,
        gdoc_facade=gdoc_facade, storage=storage,
        extraction=_extraction({}),
    )

    voucher_facade.update_extraction_progress.assert_not_called()
    voucher_facade.mark_extraction_failed.assert_not_called()


async def test_done_stage_is_noop():
    ai_facade = AsyncMock()
    voucher_facade = AsyncMock()
    gdoc_facade = AsyncMock()
    storage = AsyncMock()

    await advance_batch_stage.advance_batch_stage_if_ready(
        ai_facade=ai_facade, voucher_facade=voucher_facade,
        gdoc_facade=gdoc_facade, storage=storage,
        extraction=_extraction({"stage": "done"}),
    )

    voucher_facade.update_extraction_progress.assert_not_called()


async def test_unknown_stage_is_noop():
    ai_facade = AsyncMock()
    voucher_facade = AsyncMock()
    gdoc_facade = AsyncMock()
    storage = AsyncMock()

    await advance_batch_stage.advance_batch_stage_if_ready(
        ai_facade=ai_facade, voucher_facade=voucher_facade,
        gdoc_facade=gdoc_facade, storage=storage,
        extraction=_extraction({"stage": "no-such-stage"}),
    )

    voucher_facade.update_extraction_progress.assert_not_called()


async def test_calls_matching_stage_function_and_persists_result(monkeypatch):
    fake_s1 = AsyncMock(return_value={"stage": "s2a", "data": {}})
    monkeypatch.setitem(advance_batch_stage.STAGE_FUNCS, "s1", fake_s1)

    ai_facade = AsyncMock()
    voucher_facade = AsyncMock()
    gdoc_facade = AsyncMock()
    storage = AsyncMock()
    extraction = _extraction({"stage": "s1"})

    await advance_batch_stage.advance_batch_stage_if_ready(
        ai_facade=ai_facade, voucher_facade=voucher_facade,
        gdoc_facade=gdoc_facade, storage=storage, extraction=extraction,
    )

    fake_s1.assert_awaited_once_with(
        ai_facade=ai_facade, voucher_facade=voucher_facade,
        gdoc_facade=gdoc_facade, storage=storage,
        extraction=extraction, progress={"stage": "s1"},
    )
    voucher_facade.update_extraction_progress.assert_awaited_once_with(
        "ex-1", {"stage": "s2a", "data": {}}
    )
    voucher_facade.mark_extraction_failed.assert_not_called()


async def test_stage_advancing_to_done_skips_progress_write(monkeypatch):
    """advance_finalize가 이미 mark_extraction_completed를 호출했으므로 이중 저장 안 함."""
    fake_finalize = AsyncMock(return_value={"stage": "done", "data": {}})
    monkeypatch.setitem(advance_batch_stage.STAGE_FUNCS, "finalize", fake_finalize)

    voucher_facade = AsyncMock()
    await advance_batch_stage.advance_batch_stage_if_ready(
        ai_facade=AsyncMock(), voucher_facade=voucher_facade,
        gdoc_facade=AsyncMock(), storage=AsyncMock(),
        extraction=_extraction({"stage": "finalize"}),
    )

    voucher_facade.update_extraction_progress.assert_not_called()


async def test_invalid_operation_marks_extraction_failed(monkeypatch):
    fake_s1 = AsyncMock(side_effect=InvalidOperationException("페이지가 없습니다."))
    monkeypatch.setitem(advance_batch_stage.STAGE_FUNCS, "s1", fake_s1)

    voucher_facade = AsyncMock()
    await advance_batch_stage.advance_batch_stage_if_ready(
        ai_facade=AsyncMock(), voucher_facade=voucher_facade,
        gdoc_facade=AsyncMock(), storage=AsyncMock(),
        extraction=_extraction({"stage": "s1"}),
    )

    voucher_facade.mark_extraction_failed.assert_awaited_once()
    args, kwargs = voucher_facade.mark_extraction_failed.await_args
    assert args[0] == "ex-1"
    assert "페이지가 없습니다" in kwargs["reason"]
