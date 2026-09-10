from datetime import date, time

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.agent_query import merge_fields, normalize_limit, to_dicts
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..center_operating_time.repository import OperatingTimeRepository
from ..center_operating_time.models import OperatingTime
from ..center_operating_time.schemas import (
    OperatingTimeSummary,
    OperatingTimeResponse,
    OperatingStatusSlotsResponse,
    OperatingStatusSlotResponse,
)
from ..center_operating_time.events import OperatingTimeAtomic
from ..center_operating_time.services import (
    ListOperatingTimesService,
    BulkUpdateOperatingTimesService,
    GetOperatingStatusService,
    ListAvailableSlotsService,
)
from ..center_operating_time.services.list_operating_times_by_agent_filters import (
    ListOperatingTimesByAgentFiltersService,
)
from ..center.repository import CenterRepository
from ..center.services import GetCenterService
from ..center_operating_time.schemas import SLOT_MINUTES

__all__ = ["OperatingTimeFacade", "SLOT_MINUTES"]
from ..center_non_operating_time.repository import NonOperatingTimeRepository
from ..center_non_operating_time.services import ListMatchingByDateService

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

DEFAULT_OPERATING_TIMES = [
    {
        "weekday": "MON",
        "open_time": time(9, 0),
        "close_time": time(18, 0),
        "break_start_time": time(12, 0),
        "break_end_time": time(13, 0),
    },
    {
        "weekday": "TUE",
        "open_time": time(9, 0),
        "close_time": time(18, 0),
        "break_start_time": time(12, 0),
        "break_end_time": time(13, 0),
    },
    {
        "weekday": "WED",
        "open_time": time(9, 0),
        "close_time": time(18, 0),
        "break_start_time": time(12, 0),
        "break_end_time": time(13, 0),
    },
    {
        "weekday": "THU",
        "open_time": time(9, 0),
        "close_time": time(18, 0),
        "break_start_time": time(12, 0),
        "break_end_time": time(13, 0),
    },
    {
        "weekday": "FRI",
        "open_time": time(9, 0),
        "close_time": time(18, 0),
        "break_start_time": time(12, 0),
        "break_end_time": time(13, 0),
    },
    {
        "weekday": "SAT",
        "open_time": None,
        "close_time": None,
        "break_start_time": None,
        "break_end_time": None,
    },
    {
        "weekday": "SUN",
        "open_time": None,
        "close_time": None,
        "break_start_time": None,
        "break_end_time": None,
    },
]


class OperatingTimeFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def query_operating_time(
        self,
        center_id: str,
        *,
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
        collected = list(ids or [])
        if id:
            collected.append(id)
        merged_ids = collected or None

        service = ListOperatingTimesByAgentFiltersService(
            self._uow.repo(OperatingTimeRepository)
        )
        rows, total = await service.execute(
            center_id,
            sort=sort,
            limit=normalize_limit(limit),
            weekday=_normalize_weekday(weekday),
            date_from=coerce_date(date_from, "date_from"),
            date_to=coerce_date(date_to, "date_to"),
            ids=merged_ids,
        )

        identity = ["id", "weekday"]
        default = [
            "id", "weekday",
            "open_time", "close_time",
            "break_start_time", "break_end_time",
        ]
        available = {
            "weekday",
            "open_time", "close_time",
            "break_start_time", "break_end_time", "id",
        }
        merged = merge_fields(fields, default, available, identity=identity)

        return to_dicts(rows, merged, "operating_time" if namespaced else ""), total

    async def initialize_default_operating_times(
        self,
        center_id: str,
    ) -> tuple[OperatingTimeAtomic, list[OperatingTime]]:
        repo = self._uow.repo(OperatingTimeRepository)
        service = BulkUpdateOperatingTimesService(repo)
        return await service.execute(center_id, DEFAULT_OPERATING_TIMES, confirm=False)

    async def list_with_response(
        self,
        center_id: str,
    ) -> list[OperatingTimeSummary]:
        repo = self._uow.repo(OperatingTimeRepository)
        service = ListOperatingTimesService(repo)
        items = await service.execute(center_id)
        return [OperatingTimeSummary.model_validate(item) for item in items]

    async def bulk_update_with_response(
        self,
        center_id: str,
        items: list[dict],
        confirm: bool,
    ) -> tuple[OperatingTimeAtomic, list[OperatingTimeResponse]]:
        repo = self._uow.repo(OperatingTimeRepository)
        service = BulkUpdateOperatingTimesService(repo)
        atomic, operating_times = await service.execute(center_id, items, confirm)
        return atomic, [
            OperatingTimeResponse.model_validate(ot) for ot in operating_times
        ]

    async def list_available_slots_with_response(
        self,
        center_id: str,
        target_date: date,
    ) -> OperatingStatusSlotsResponse:
        center_repo = self._uow.repo(CenterRepository)
        get_center_service = GetCenterService(center_repo)
        await get_center_service.execute(center_id)

        non_op_repo = self._uow.repo(NonOperatingTimeRepository)
        list_matching_service = ListMatchingByDateService(non_op_repo)
        non_operating_times = await list_matching_service.execute(
            center_id, target_date
        )

        repo = self._uow.repo(OperatingTimeRepository)
        service = ListAvailableSlotsService(repo)
        available_slots = await service.execute(
            center_id, target_date, non_operating_times
        )

        return OperatingStatusSlotsResponse(
            date=target_date.isoformat(),
            available_slots=available_slots,
        )

    async def get_operating_status_with_response(
        self,
        center_id: str,
        target_date: date,
        slot: str,
    ) -> OperatingStatusSlotResponse:
        center_repo = self._uow.repo(CenterRepository)
        get_center_service = GetCenterService(center_repo)
        await get_center_service.execute(center_id)

        non_op_repo = self._uow.repo(NonOperatingTimeRepository)
        list_matching_service = ListMatchingByDateService(non_op_repo)
        non_operating_times = await list_matching_service.execute(
            center_id, target_date
        )

        repo = self._uow.repo(OperatingTimeRepository)
        service = GetOperatingStatusService(repo)
        is_operating, reason = await service.execute(
            center_id, target_date, slot, non_operating_times
        )

        return OperatingStatusSlotResponse(
            date=target_date.isoformat(),
            slot=slot,
            is_operating=is_operating,
            reason=reason,
        )
