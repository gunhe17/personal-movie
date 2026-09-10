from datetime import datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..schedule_change_request.events import ScheduleChangeRequestAtomic
from ..schedule_change_request.models import ScheduleChangeRequest
from ..schedule_change_request.repository import ScheduleChangeRequestRepository
from ..schedule_change_request.services import (
    CreateChangeRequestService,
    DecideChangeRequestService,
    GetChangeRequestService,
    ListChangeRequestsService,
    ListPendingBySchedulesService,
)


class ScheduleChangeRequestFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _repo(self) -> ScheduleChangeRequestRepository:
        return self._uow.repo(ScheduleChangeRequestRepository)

    async def create_change_request(
        self,
        center_id: str,
        schedule_id: str,
        person_id: str,
        client_id: str,
        current_start: datetime,
        current_end: datetime,
        requested_start: datetime,
        requested_end: datetime,
        reason: str | None = None,
    ) -> tuple[ScheduleChangeRequestAtomic, ScheduleChangeRequest]:
        service = CreateChangeRequestService(self._repo())
        return await service.execute(
            center_id=center_id,
            schedule_id=schedule_id,
            person_id=person_id,
            client_id=client_id,
            current_start=current_start,
            current_end=current_end,
            requested_start=requested_start,
            requested_end=requested_end,
            reason=reason,
        )

    async def decide_change_request(
        self,
        request_id: str,
        center_id: str,
        status: str,
        decided_by_member_id: str | None = None,
        decision_note: str | None = None,
    ) -> tuple[ScheduleChangeRequestAtomic, ScheduleChangeRequest]:
        service = DecideChangeRequestService(self._repo())
        return await service.execute(
            request_id=request_id,
            center_id=center_id,
            status=status,
            decided_by_member_id=decided_by_member_id,
            decision_note=decision_note,
        )

    async def get_change_request(self, request_id: str, center_id: str) -> ScheduleChangeRequest:
        service = GetChangeRequestService(self._repo())
        return await service.execute(request_id=request_id, center_id=center_id)

    async def list_change_requests(self, center_id: str, status: str | None = None) -> list[ScheduleChangeRequest]:
        service = ListChangeRequestsService(self._repo())
        return await service.execute(center_id=center_id, status=status)

    async def list_pending_by_schedule_ids(self, schedule_ids: list[str]) -> list[ScheduleChangeRequest]:
        service = ListPendingBySchedulesService(self._repo())
        return await service.execute(schedule_ids=schedule_ids)
