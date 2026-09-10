from datetime import date, datetime, time

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..center_non_operating_time.repository import NonOperatingTimeRepository
from ..center_non_operating_time.models import NonOperatingTime
from ..center_non_operating_time.events import NonOperatingTimeAtomic
from ..center_non_operating_time.schemas import (
    NonOperatingTimeResponse,
    RegisterCenterHolidaysResponse,
)
from ..center_non_operating_time.services import (
    CreateNonOperatingTimeService,
    GetNonOperatingTimeService,
    UpdateNonOperatingTimeService,
    DeleteNonOperatingTimeService,
    RegisterCenterHolidaysService,
    ListNonOperatingTimesService,
    ListMatchingByDateService,
)


class NonOperatingTimeFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def list_matching_by_date(
        self, center_id: str, target_date: date
    ) -> list[NonOperatingTime]:
        repo = self._uow.repo(NonOperatingTimeRepository)
        service = ListMatchingByDateService(repo)
        return await service.execute(center_id, target_date)

    async def create(
        self,
        center_id: str,
        year: int | None,
        month: int | None,
        day: int | None,
        month_week: int | None,
        weekday: str | None,
        start_time: time | None,
        end_time: time | None,
        effective_from: datetime | None,
        effective_to: datetime | None,
        reason: str,
        confirm: bool,
        created_by: str | None = None,
    ) -> tuple[NonOperatingTimeAtomic, NonOperatingTime]:
        repo = self._uow.repo(NonOperatingTimeRepository)
        service = CreateNonOperatingTimeService(repo)
        return await service.execute(
            center_id=center_id,
            year=year,
            month=month,
            day=day,
            month_week=month_week,
            weekday=weekday,
            start_time=start_time,
            end_time=end_time,
            effective_from=effective_from,
            effective_to=effective_to,
            reason=reason,
            confirm=confirm,
            created_by=created_by,
        )

    async def get_with_response(
        self,
        center_id: str,
        non_operating_time_id: str,
    ) -> NonOperatingTimeResponse:
        repo = self._uow.repo(NonOperatingTimeRepository)
        service = GetNonOperatingTimeService(repo)
        non_op = await service.execute(center_id, non_operating_time_id)
        return NonOperatingTimeResponse.model_validate(non_op)

    async def list_with_response(
        self,
        center_id: str,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = False,
    ) -> list[NonOperatingTimeResponse]:
        repo = self._uow.repo(NonOperatingTimeRepository)
        service = ListNonOperatingTimesService(repo)
        items = await service.execute(center_id, skip, limit, active_only)
        return [NonOperatingTimeResponse.model_validate(item) for item in items]

    async def update(
        self,
        center_id: str,
        non_operating_time_id: str,
        start_time: time | None = None,
        end_time: time | None = None,
        effective_to: datetime | None = None,
        reason: str | None = None,
        confirm: bool = False,
        changed: dict | None = None,
    ) -> tuple[NonOperatingTimeAtomic, NonOperatingTime]:
        repo = self._uow.repo(NonOperatingTimeRepository)
        service = UpdateNonOperatingTimeService(repo)
        return await service.execute(
            center_id=center_id,
            non_operating_time_id=non_operating_time_id,
            start_time=start_time,
            end_time=end_time,
            effective_to=effective_to,
            reason=reason,
            confirm=confirm,
            changed=changed,
        )

    async def delete(
        self,
        center_id: str,
        non_operating_time_id: str,
    ) -> tuple[NonOperatingTimeAtomic, NonOperatingTime]:
        repo = self._uow.repo(NonOperatingTimeRepository)
        service = DeleteNonOperatingTimeService(repo)
        return await service.execute(center_id, non_operating_time_id)

    async def register_holidays_with_response(
        self,
        center_id: str,
        year: int,
        holidays: list[dict],
    ) -> tuple[list[NonOperatingTimeAtomic], RegisterCenterHolidaysResponse]:
        if not holidays:
            return [], RegisterCenterHolidaysResponse(
                registered_count=0,
                year=year,
                items=[],
            )

        repo = self._uow.repo(NonOperatingTimeRepository)
        service = RegisterCenterHolidaysService(repo)
        atomics, created = await service.execute(
            center_id=center_id,
            year=year,
            holidays=holidays,
        )
        return atomics, RegisterCenterHolidaysResponse(
            registered_count=len(created),
            year=year,
            items=[NonOperatingTimeResponse.model_validate(c) for c in created],
        )
