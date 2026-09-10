from datetime import datetime

from app.core.datetime_utils import parse_datetime
from app.core.type import unset
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schedule.repository import ScheduleRepository
from ..schedule.services.aggregate_usual_schedule import AggregateUsualScheduleService
from ..schedule.services.create_schedule import CreateScheduleService
from ..schedule.services.delete_schedule import DeleteScheduleService
from ..schedule.services.delete_schedules import DeleteSchedulesService
from ..schedule.services.list_schedule_ids_by_date_range import (
    ListScheduleIdsByDateRangeService,
)
from ..schedule.services.list_schedules_starting_in_range import (
    ListSchedulesStartingInRangeService,
)
from ..schedule.services.get_schedule import GetScheduleService
from ..schedule.services.list_schedules_by_ids import ListSchedulesByIdsService
from ..schedule.services.list_schedules import ListSchedulesService
from ..schedule.services.list_conflicting_schedules import (
    ListConflictingSchedulesService,
)
from ..schedule.services.restore_schedules import RestoreSchedulesService
from ..schedule.services.update_schedule import UpdateScheduleService
from ..schedule.services.validate_recurring_schedules import (
    ValidateRecurringSchedulesService,
)
from ..schedule.services.validate_schedule_dates import ValidateScheduleDatesService
from ..schedule.models import Schedule
from ..schedule.events import ScheduleAtomic
from ..schedule.schemas import (
    BatchScheduleValidation,
    ScheduleValidationResponse,
    DatesScheduleValidationResponse,
)


class ScheduleFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def create_schedule(
        self,
        center_id: str,
        schedule_type: str,
        start: str | datetime,
        end: str | datetime,
        member_id: str | None = None,
        room_id: str | None = None,
        title: str | None = None,
        memo: str | None = None,
    ) -> tuple[ScheduleAtomic, Schedule]:
        start = parse_datetime(start) if isinstance(start, str) else start
        end = parse_datetime(end) if isinstance(end, str) else end

        repo = self._uow.repo(ScheduleRepository)
        service = CreateScheduleService(repo)
        return await service.execute(
            center_id=center_id,
            schedule_type=schedule_type,
            start=start,
            end=end,
            member_id=member_id,
            room_id=room_id,
            title=title,
            memo=memo,
        )

    async def get_schedule(self, schedule_id: str, center_id: str) -> Schedule:
        repo = self._uow.repo(ScheduleRepository)
        service = GetScheduleService(repo)
        return await service.execute(schedule_id, center_id)

    async def aggregate_usual_schedule(
        self,
        center_id: str,
        member_id: str,
        *,
        since: datetime,
    ) -> tuple[str | None, int | None]:
        repo = self._uow.repo(ScheduleRepository)
        return await AggregateUsualScheduleService(repo).execute(
            center_id=center_id,
            member_id=member_id,
            since=since,
        )

    async def update_schedule(
        self,
        center_id: str,
        schedule_id: str,
        *,
        member_id: str | None = unset,
        title: str | None = unset,
        room_id: str | None = unset,
        start: str | datetime = unset,
        end: str | datetime = unset,
        memo: str | None = unset,
        changed: dict | None = None,
    ) -> tuple[ScheduleAtomic, Schedule]:
        start = parse_datetime(start) if isinstance(start, str) else start
        end = parse_datetime(end) if isinstance(end, str) else end

        repo = self._uow.repo(ScheduleRepository)
        service = UpdateScheduleService(repo)
        return await service.execute(
            schedule_id=schedule_id,
            center_id=center_id,
            member_id=member_id,
            title=title,
            room_id=room_id,
            start=start,
            end=end,
            memo=memo,
            changed=changed,
        )

    async def delete_schedule(
        self,
        center_id: str,
        schedule_id: str,
    ) -> tuple[ScheduleAtomic, Schedule]:
        repo = self._uow.repo(ScheduleRepository)
        service = DeleteScheduleService(repo)
        return await service.execute(
            schedule_id=schedule_id,
            center_id=center_id,
        )

    async def delete_schedules(
        self, schedule_ids: list[str]
    ) -> tuple[list[ScheduleAtomic], int]:
        repo = self._uow.repo(ScheduleRepository)
        service = DeleteSchedulesService(repo)
        return await service.execute(schedule_ids)

    async def restore_schedules(
        self, schedule_ids: list[str]
    ) -> tuple[list[ScheduleAtomic], int]:
        repo = self._uow.repo(ScheduleRepository)
        service = RestoreSchedulesService(repo)
        return await service.execute(schedule_ids)

    async def list_schedules(
        self,
        center_id: str,
        start: datetime,
        end: datetime,
        schedule_types: list[str] | None = None,
        member_ids: list[str] | None = None,
        room_id: str | None = None,
        title: str | None = None,
    ) -> list[Schedule]:
        repo = self._uow.repo(ScheduleRepository)
        service = ListSchedulesService(repo)
        return await service.execute(
            center_id=center_id,
            start=start,
            end=end,
            title=title,
            schedule_types=schedule_types,
            member_ids=member_ids,
            room_id=room_id,
        )

    async def list_schedules_by_ids(self, schedule_ids: list[str]) -> list[Schedule]:
        repo = self._uow.repo(ScheduleRepository)
        service = ListSchedulesByIdsService(repo)
        return await service.execute(schedule_ids)

    async def get_schedule_summaries_by_ids(
        self, schedule_ids: list[str]
    ) -> dict[str, str]:
        if not schedule_ids:
            return {}
        schedules = await self.list_schedules_by_ids(schedule_ids)
        return {
            s.id: f"{s.start:%m-%d %H:%M} · {s.title}"
            if s.title
            else f"{s.start:%m-%d %H:%M}"
            for s in schedules
        }

    async def list_schedule_ids_by_date_range(
        self,
        center_id: str,
        schedule_type: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[str]:
        repo = self._uow.repo(ScheduleRepository)
        service = ListScheduleIdsByDateRangeService(repo)
        return await service.execute(
            center_id=center_id,
            schedule_type=schedule_type,
            start_date=start_date,
            end_date=end_date,
        )

    async def list_schedules_starting_in_range(
        self,
        start_utc: datetime,
        end_utc: datetime,
        schedule_types: list[str],
    ) -> list[Schedule]:
        # center_id 없이 전 센터 글로벌 스캔 (알림 배치 잡 전용)
        repo = self._uow.repo(ScheduleRepository)
        service = ListSchedulesStartingInRangeService(repo)
        return await service.execute(
            start_utc=start_utc,
            end_utc=end_utc,
            schedule_types=schedule_types,
        )

    async def list_conflicting_schedules(
        self,
        center_id: str,
        *,
        start: datetime,
        end: datetime,
        room_id: str | None = None,
        member_id: str | None = None,
        exclude_id: str | None = None,
    ) -> list[Schedule]:
        repo = self._uow.repo(ScheduleRepository)
        service = ListConflictingSchedulesService(repo)
        return await service.execute(
            center_id=center_id,
            start=start,
            end=end,
            room_id=room_id,
            member_id=member_id,
            exclude_id=exclude_id,
        )

    async def validate_schedule(
        self,
        center_id: str,
        room_id: str,
        start: datetime,
        end: datetime,
        exclude_id: str | None = None,
        member_id: str | None = None,
    ) -> list[Schedule]:
        return await self.list_conflicting_schedules(
            center_id=center_id,
            start=start,
            end=end,
            room_id=room_id,
            member_id=member_id,
            exclude_id=exclude_id,
        )

    async def validate_recurring_schedules(
        self,
        center_id: str,
        data: BatchScheduleValidation,
    ) -> ScheduleValidationResponse:
        repo = self._uow.repo(ScheduleRepository)
        service = ValidateRecurringSchedulesService(repo)

        conflicts, schedule_dates, truncated_count = await service.execute(
            center_id, data
        )

        # until 기반 반복은 data.count가 None이라, 실제 계산된 날짜 수를 센다.
        total_schedules = len(schedule_dates)

        return ScheduleValidationResponse(
            has_conflicts=len(conflicts) > 0,
            total_schedules=total_schedules,
            conflicts=conflicts,
            truncated=truncated_count > 0,
            truncated_count=truncated_count,
            validated_data=data,
            schedule_dates=schedule_dates,
        )

    async def validate_schedule_dates(
        self,
        center_id: str,
        dates: list,
        start_time: str,
        end_time: str,
        room_id: str,
        exclude_schedule_id: str | None = None,
        member_id: str | None = None,
    ) -> DatesScheduleValidationResponse:
        repo = self._uow.repo(ScheduleRepository)
        service = ValidateScheduleDatesService(repo)

        conflicts, truncated_count = await service.execute(
            center_id=center_id,
            dates=dates,
            start_time=start_time,
            end_time=end_time,
            room_id=room_id,
            exclude_id=exclude_schedule_id,
            member_id=member_id,
        )

        return DatesScheduleValidationResponse(
            has_conflicts=len(conflicts) > 0,
            total_schedules=len(dates),
            conflicts=conflicts,
            truncated=truncated_count > 0,
            truncated_count=truncated_count,
        )
