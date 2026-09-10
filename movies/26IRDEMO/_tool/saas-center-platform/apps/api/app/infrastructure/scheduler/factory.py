from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.infrastructure.scheduler.apscheduler.client import ApScheduler
from app.infrastructure.scheduler.common.base import Scheduler


@lru_cache
def get_scheduler() -> Scheduler:
    return ApScheduler(enabled=settings.ENABLE_SCHEDULER)
