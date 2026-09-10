from datetime import date

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.agent_query import merge_fields, normalize_limit, to_dicts
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..member.repository import MemberRepository
from ..member.services import GetMemberService
from ..member_working_time.repository import MemberWorkingTimeRepository
from ..member_working_time.schemas import (
    MemberWorkingTimeResponse,
    MemberWorkingTimeBulkCreate,
    WorkingStatusSlotsResponse,
    WorkingStatusSlotResponse,
)
from ..member_working_time.events import MemberWorkingTimeAtomic
from ..member_working_time.services import (
    ListMemberWorkingTimesService,
    BulkUpdateMemberWorkingTimesService,
    GetWorkingStatusService,
    ListAvailableSlotsService,
)
from ..member_working_time.services.list_member_working_times_by_agent_filters import (
    ListMemberWorkingTimesByAgentFiltersService,
)
from ..member_non_working_time.repository import MemberNonWorkingTimeRepository
from ..member_non_working_time.services import ListMatchingByDateService

DEFAULT_FIELDS = [
    "id", "member_id", "weekday",
    "start_time", "end_time",
    "break_start_time", "break_end_time",
]
_WEEKDAY_CODES = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}
_WEEKDAY_MAP = {
    "monday": "MON", "tuesday": "TUE", "wednesday": "WED", "thursday": "THU",
    "friday": "FRI", "saturday": "SAT", "sunday": "SUN",
    "월요일": "MON", "화요일": "TUE", "수요일": "WED", "목요일": "THU",
    "금요일": "FRI", "토요일": "SAT", "일요일": "SUN",
}


def _normalize_weekday(v: str | None) -> str | None:
    if not v:
        return None
    key = v.strip().lower()
    if key in _WEEKDAY_MAP:
        return _WEEKDAY_MAP[key]
    upper = v.strip().upper()[:3]
    return upper if upper in _WEEKDAY_CODES else None


class MemberWorkingTimeFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def query_member_working_time(
        self,
        center_id: str,
        *,
        member_id: str | None = None,
        member_ids: list[str] | None = None,
        weekday: str | None = None,
        date_from: str | date | None = None,
        date_to: str | date | None = None,
        id: str | None = None,
        ids: list[str] | None = None,
        sort: str | None = None,
        limit: int | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> tuple[list[dict], int]:
        # 크로스모듈 이름(member_name)은 query handler 본문이 인라인 조립
        collected = list(ids or [])
        if id:
            collected.append(id)
        merged_ids = collected or None

        service = ListMemberWorkingTimesByAgentFiltersService(
            self._uow.repo(MemberWorkingTimeRepository)
        )
        rows, total = await service.execute(
            center_id,
            sort=sort,
            limit=normalize_limit(limit),
            member_id=member_id,
            member_ids=member_ids,
            weekday=_normalize_weekday(weekday),
            date_from=coerce_date(date_from, "date_from"),
            date_to=coerce_date(date_to, "date_to"),
            ids=merged_ids,
        )

        identity = ["id", "member_id", "weekday"]
        default = DEFAULT_FIELDS
        available = {
            "member_id", "weekday",
            "start_time", "end_time",
            "break_start_time", "break_end_time", "id",
        }
        merged = merge_fields(fields, default, available, identity=identity)

        return to_dicts(rows, merged, "member_working_time" if namespaced else ""), total

    async def list_with_response(
        self,
        center_id: str,
        member_id: str,
    ) -> list[MemberWorkingTimeResponse]:
        member_repo = self._uow.repo(MemberRepository)
        get_member_service = GetMemberService(member_repo)
        await get_member_service.execute(member_id, center_id)

        repo = self._uow.repo(MemberWorkingTimeRepository)
        service = ListMemberWorkingTimesService(repo)
        working_times = await service.execute(member_id)

        return [MemberWorkingTimeResponse.model_validate(wt) for wt in working_times]

    async def bulk_update_with_response(
        self,
        center_id: str,
        member_id: str,
        items: list[dict],
        confirm: bool = False,
    ) -> tuple[MemberWorkingTimeAtomic, list[MemberWorkingTimeResponse]]:
        from ..member_working_time.schemas import MemberWorkingTimeCreate
        data = MemberWorkingTimeBulkCreate(
            items=[MemberWorkingTimeCreate(**item) for item in items]
        )

        member_repo = self._uow.repo(MemberRepository)
        get_member_service = GetMemberService(member_repo)
        await get_member_service.execute(member_id, center_id)

        repo = self._uow.repo(MemberWorkingTimeRepository)
        service = BulkUpdateMemberWorkingTimesService(repo)
        atomic, working_times = await service.execute(
            center_id=center_id,
            member_id=member_id,
            items=[i.model_dump() for i in data.items],
        )

        return atomic, [MemberWorkingTimeResponse.model_validate(wt) for wt in working_times]

    async def list_available_slots_with_response(
        self,
        center_id: str,
        member_id: str,
        target_date: date,
    ) -> WorkingStatusSlotsResponse:
        member_repo = self._uow.repo(MemberRepository)
        get_member_service = GetMemberService(member_repo)
        await get_member_service.execute(member_id, center_id)

        nwt_repo = self._uow.repo(MemberNonWorkingTimeRepository)
        nwt_service = ListMatchingByDateService(nwt_repo)
        non_working_times = await nwt_service.execute(member_id, target_date)

        repo = self._uow.repo(MemberWorkingTimeRepository)
        service = ListAvailableSlotsService(repo)
        available_slots = await service.execute(
            member_id, target_date, non_working_times
        )

        return WorkingStatusSlotsResponse(
            date=target_date.isoformat(),
            available_slots=available_slots,
        )

    async def get_working_status_with_response(
        self,
        center_id: str,
        member_id: str,
        target_date: date,
        slot: str,
    ) -> WorkingStatusSlotResponse:
        member_repo = self._uow.repo(MemberRepository)
        get_member_service = GetMemberService(member_repo)
        await get_member_service.execute(member_id, center_id)

        nwt_repo = self._uow.repo(MemberNonWorkingTimeRepository)
        nwt_service = ListMatchingByDateService(nwt_repo)
        non_working_times = await nwt_service.execute(member_id, target_date)

        repo = self._uow.repo(MemberWorkingTimeRepository)
        service = GetWorkingStatusService(repo)
        is_working, reason = await service.execute(
            member_id, target_date, slot, non_working_times
        )

        return WorkingStatusSlotResponse(
            date=target_date.isoformat(),
            slot=slot,
            is_working=is_working,
            reason=reason,
        )
