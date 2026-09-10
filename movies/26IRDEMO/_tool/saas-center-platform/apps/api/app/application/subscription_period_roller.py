from uuid import uuid4

from app.behavior.action.event import Event
from app.core.logger import get_logger
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.unit_of_work import UnitOfWork

logger = get_logger(__name__)


# 기간 경계 정산 어댑터 — 자체 세션에서 원자 커밋.
# 과금 AI 소비 직전 조율층 시임(dispatch_job·agent 스트림 개시)에서 호출.
# 게이트웨이 쿼터 확인은 독립 세션 — 정산이 여기서 먼저 커밋돼야 새 balance를 본다.
# 정산 실패는 삼킴 — AI 호출 막지 않고 기존 balance로 진행(크론이 backstop).
class SubscriptionPeriodRoller:
    def __init__(self, session_factory):
        self._sf = session_factory

    async def ensure_current_period(self, center_id: str) -> None:
        # lazy: subscription/credit 도메인 사슬을 import 시점에 안 끌어옴(순환 방지)
        from app.application.handlers.subscription import roll_center_period_handler

        try:
            event_group_id = str(uuid4())
            async with self._sf() as session:
                uow = UnitOfWork(session)
                emitted = await roll_center_period_handler(
                    uow=uow,
                    center_id=center_id,
                    event_group_id=event_group_id,
                )
                await session.commit()
            if emitted:
                await Event.dispatch_event(event_group_id)
        except Exception:
            logger.warning(
                "[period_roll] 정산 실패 — 기존 balance로 진행: center=%s",
                center_id[:8],
                exc_info=True,
            )


period_roller = SubscriptionPeriodRoller(AsyncSessionLocal)
