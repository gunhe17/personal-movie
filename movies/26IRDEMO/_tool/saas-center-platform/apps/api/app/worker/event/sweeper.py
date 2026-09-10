import asyncio
import json

from sqlalchemy import text

from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import transactional_uow
from app.modules.event.event.repository import EventRepository

logger = get_logger(__name__)


async def _sweep(lease_seconds: int, limit: int) -> None:
    # NOTIFY 유실 보강 — pending/lease 만료 claimed 를 재-NOTIFY
    async with transactional_uow() as uow:
        ids = await uow.repo(EventRepository).claim_stale(lease_seconds=lease_seconds, limit=limit)
        for group_id in ids:
            await uow.session.execute(
                text("SELECT pg_notify('event_group', :p)"),
                {"p": json.dumps({"group_id": group_id})},
            )


async def run_sweeper(*, interval_seconds: int = 30, lease_seconds: int = 60, limit: int = 100) -> None:
    # 워커 reliability 백본 — cron 이 아니라 상시 가동(ENABLE_SCHEDULER 무관). 워커 종료 시 task cancel.
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            await _sweep(lease_seconds, limit)
        except Exception:
            logger.error("event sweep failed", exc_info=True)
