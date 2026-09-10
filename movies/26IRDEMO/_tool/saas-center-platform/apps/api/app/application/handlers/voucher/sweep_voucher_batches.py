# 크론 안전망 — 워커 잡이 유실·중단돼 processing 상태로 멈춘 extraction 을 다시 큐에 넣는다.
from __future__ import annotations

from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.application.handlers.voucher.enqueue_voucher_extraction import (
    enqueue_voucher_extraction_handler,
)

logger = get_logger(__name__)

# 방금 전진한 건(progress 갱신)은 워커가 살아 있다는 뜻이라 건드리지 않는다.
_STALE_AFTER = timedelta(minutes=10)


async def sweep_voucher_batches_handler(*, uow: UnitOfWork) -> int:
    voucher_facade = VoucherFacade(uow)
    extractions = await voucher_facade.list_stuck_processing_extractions(
        stale_before=utc_now() - _STALE_AFTER
    )

    for extraction in extractions:
        # 직접 전진하지 않는다 — 잡을 다시 넣어 워커가 자기 수명으로 돌게 한다
        await enqueue_voucher_extraction_handler(extraction_id=extraction.id)

    if extractions:
        logger.info("[voucher/sweep] 재투입=%d", len(extractions))
    return len(extractions)
