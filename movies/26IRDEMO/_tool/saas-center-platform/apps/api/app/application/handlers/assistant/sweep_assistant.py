# 크론 — 프로세스 즉사 잔재(running)와 방치된 빈 대화 정리 (터미널 flush의 backstop)
from __future__ import annotations

from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assistant.facade import AssistantFacade

logger = get_logger(__name__)

# 스트림 최대 수 분 — 30분 넘은 running은 즉사 잔재로 판정
_RUNNING_STALE = timedelta(minutes=30)
_EMPTY_STALE = timedelta(days=1)


async def sweep_assistant_handler(
    *,
    uow: UnitOfWork,
) -> tuple[int, int]:
    now = utc_now()
    stale, empty = await AssistantFacade(uow).sweep_assistant(
        running_cutoff=now - _RUNNING_STALE,
        empty_cutoff=now - _EMPTY_STALE,
    )
    if stale or empty:
        logger.info(
            "[assistant/sweep] stale_running=%d empty_conversations=%d", stale, empty
        )
    return stale, empty
