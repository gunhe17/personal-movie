from datetime import date, datetime, time

from app.core.type import unset
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..member_non_working_time.events import MemberNonWorkingTimeAtomic
from ..member_non_working_time.repository import MemberNonWorkingTimeRepository
from ..member_non_working_time.models import MemberNonWorkingTime
from ..member_non_working_time.schemas import (
    MemberNonWorkingTimeCreate,
    MemberNonWorkingTimeResponse,
    MemberNonWorkingTimeSummary,
    MemberNonWorkingTimeListResponse,
    MemberNonWorkingTimeReason,
)
from ..member_non_working_time.services import (
    CreateMemberNonWorkingTimeService,
    GetMemberNonWorkingTimeService,
    ListMemberNonWorkingTimesService,
    UpdateMemberNonWorkingTimeService,
    DeleteMemberNonWorkingTimeService,
    ListMatchingByDateService,
)


class MemberNonWorkingTimeFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def list_matching_by_date(
        self, member_id: str, target_date: date
    ) -> list[MemberNonWorkingTime]:
        repo = self._uow.repo(MemberNonWorkingTimeRepository)
        service = ListMatchingByDateService(repo)
        return await service.execute(member_id, target_date)

    async def create(
        self,
        member_id: str,
        center_id: str,
        reason: str,
        year: int | None = None,
        month: int | None = None,
        day: int | None = None,
        month_week: int | None = None,
        weekday: str | None = None,
        start_time: str | None = None,
        end_time: str | None = None,
        effective_from: str | None = None,
        effective_to: str | None = None,
        description: str | None = None,
    ) -> tuple[MemberNonWorkingTimeAtomic, MemberNonWorkingTime]:
        fields: dict = {"reason": reason}
        for k, v in [
            ("year", year),
            ("month", month),
            ("day", day),
            ("month_week", month_week),
            ("weekday", weekday),
            ("start_time", start_time),
            ("end_time", end_time),
            ("effective_from", effective_from),
            ("effective_to", effective_to),
            ("description", description),
        ]:
            if v is not None:
                fields[k] = v
        data = MemberNonWorkingTimeCreate(**fields)
        repo = self._uow.repo(MemberNonWorkingTimeRepository)
        service = CreateMemberNonWorkingTimeService(repo)
        create_data = data.model_dump()
        create_data["reason"] = create_data["reason"].value
        if create_data.get("weekday"):
            create_data["weekday"] = create_data["weekday"].value
        return await service.execute(
            member_id=member_id, center_id=center_id, **create_data
        )

    async def get_with_response(
        self,
        member_id: str,
        non_working_time_id: str,
    ) -> MemberNonWorkingTimeResponse:
        repo = self._uow.repo(MemberNonWorkingTimeRepository)
        service = GetMemberNonWorkingTimeService(repo)
        non_working_time = await service.execute(member_id, non_working_time_id)
        return MemberNonWorkingTimeResponse.model_validate(non_working_time)

    async def list_with_response(
        self,
        member_id: str,
        year: int | None = None,
        reason: MemberNonWorkingTimeReason | None = None,
        page: int = 1,
        size: int = 20,
    ) -> MemberNonWorkingTimeListResponse:
        repo = self._uow.repo(MemberNonWorkingTimeRepository)
        service = ListMemberNonWorkingTimesService(repo)

        reason_value = reason.value if reason else None
        skip = (page - 1) * size

        items, total = await service.execute(
            member_id, year=year, reason=reason_value, skip=skip, limit=size
        )
        pages = (total + size - 1) // size if total > 0 else 1

        return MemberNonWorkingTimeListResponse(
            items=[MemberNonWorkingTimeSummary.model_validate(item) for item in items],
            total=total,
            page=page,
            size=size,
            pages=pages,
        )

    async def update(
        self,
        member_id: str,
        non_working_time_id: str,
        start_time: time | None = unset,
        end_time: time | None = unset,
        effective_to: datetime | None = unset,
        reason: str = unset,
        description: str | None = unset,
        changed: dict | None = None,
    ) -> tuple[MemberNonWorkingTimeAtomic, MemberNonWorkingTime]:
        fields = {
            "start_time": start_time,
            "end_time": end_time,
            "effective_to": effective_to,
            "reason": reason,
            "description": description,
        }
        repo = self._uow.repo(MemberNonWorkingTimeRepository)
        service = UpdateMemberNonWorkingTimeService(repo)
        return await service.execute(
            member_id=member_id,
            non_working_time_id=non_working_time_id,
            changed=changed
            if changed is not None
            else {
                key: value.isoformat() if isinstance(value, (datetime, time)) else value
                for key, value in fields.items()
                if value is not unset
            },
            **fields,
        )

    async def delete(
        self,
        member_id: str,
        non_working_time_id: str,
    ) -> tuple[MemberNonWorkingTimeAtomic, MemberNonWorkingTime]:
        repo = self._uow.repo(MemberNonWorkingTimeRepository)
        service = DeleteMemberNonWorkingTimeService(repo)
        return await service.execute(member_id, non_working_time_id)
