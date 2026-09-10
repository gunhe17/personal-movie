from datetime import datetime, timedelta

from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.person_profile import PersonProfileFacade

from .analyze_usage import analyze_usage_handler


def _is_stale(
    analyzed_at: datetime | None,
    stale_days: int,
) -> bool:
    if analyzed_at is None:
        return True
    return utc_now() - analyzed_at > timedelta(days=stale_days)


async def analyze_profile_if_stale_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    member_id: str,
) -> None:
    # verify — 낡았을 때만 (매 conversation마다 LLM 재분석 방지)
    profile = await PersonProfileFacade(uow).find_person_profile(
        center_id=center_id, member_id=member_id
    )
    if not _is_stale(
        profile.analyzed_at if profile else None, settings.PROFILE_STALE_DAYS
    ):
        return

    # analyze — 게이트웨이 단발(수초). 분당 수십 건 규모가 되면 Track B enqueue로 승격
    await analyze_usage_handler(center_id=center_id, member_id=member_id, uow=uow)
