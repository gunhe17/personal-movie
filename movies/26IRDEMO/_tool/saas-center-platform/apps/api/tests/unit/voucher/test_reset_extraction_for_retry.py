"""ResetExtractionForRetryService — 재시도가 파이프라인을 route(첫 스테이지)부터 재시작하는지.

회귀 대상: progress를 안 건드리던 결함 — 중단 시점의 stage/data가 남아있으면
재시도가 처음부터 다시 돌지 않는다.
"""
from unittest.mock import AsyncMock

from app.modules.voucher.voucher_extraction.models import VoucherExtractionStatus
from app.modules.voucher.voucher_extraction.services.reset_extraction_for_retry import (
    ResetExtractionForRetryService,
)


async def test_resets_stage_to_route_and_clears_failure():
    repo = AsyncMock()

    await ResetExtractionForRetryService(repo).execute("ex-1")

    kwargs = repo.update_in_place.await_args.kwargs
    assert kwargs["progress"] == {"stage": "route"}
    assert kwargs["status"] == VoucherExtractionStatus.PROCESSING
    assert kwargs["failed"] is None
    assert kwargs["failed_at"] is None
    assert kwargs["completed_at"] is None
