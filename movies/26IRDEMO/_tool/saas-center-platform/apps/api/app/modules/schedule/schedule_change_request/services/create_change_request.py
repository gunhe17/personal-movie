from datetime import datetime

from app.core.exceptions import ConflictException

from ..events import ScheduleChangeRequestAtomic
from ..models import ScheduleChangeRequest
from ..repository import ScheduleChangeRequestRepository


class CreateChangeRequestService:
    def __init__(self, repo: ScheduleChangeRequestRepository):
        self.repo = repo

    async def execute(
        self,
        *,
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
        # verify
        pending = await self.repo.find_pending_by_schedule(schedule_id=schedule_id)
        if pending:
            raise ConflictException("이미 변경 요청이 접수된 일정이에요")

        # create
        request = await self.repo.add(
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

        # return
        return ScheduleChangeRequestAtomic.created(request=request)
