from __future__ import annotations

from typing import TYPE_CHECKING, Callable

from app.core.logger import get_logger
from app.infrastructure.scheduler.common.base import Scheduler

if TYPE_CHECKING:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = get_logger(__name__)


class ApScheduler(Scheduler):
    def __init__(
        self,
        *,
        enabled: bool,
    ) -> None:
        self._enabled = enabled
        self._scheduler: "AsyncIOScheduler | None" = None

    def start(self, register_jobs: Callable | None = None) -> None:
        if not self._enabled:
            logger.info("⏸️  Scheduler disabled (ENABLE_SCHEDULER=False)")
            return
        if self._scheduler is not None:
            logger.info("⏰ Scheduler already running, skipping start")
            return

        # apscheduler 의존성은 enabled 일 때만 필요 — lazy import
        from apscheduler.schedulers.asyncio import AsyncIOScheduler

        self._scheduler = AsyncIOScheduler()
        if register_jobs is not None:
            register_jobs(self._scheduler)
        self._scheduler.start()
        logger.info(f"⏰ Scheduler started with {len(self._scheduler.get_jobs())} job(s)")

    def stop(self) -> None:
        if self._scheduler is None:
            return
        try:
            self._scheduler.shutdown(wait=False)
            logger.info("🛑 Scheduler stopped")
        except Exception:
            logger.error("Scheduler shutdown failed", exc_info=True)
        finally:
            self._scheduler = None
