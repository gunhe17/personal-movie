from datetime import datetime, timezone

from app.core.exceptions import ConflictException, EntityNotFoundException, PermissionDeniedException

from ..events import ScheduleChangeRequestAtomic
from ..models import ScheduleChangeRequest
from ..repository import ScheduleChangeRequestRepository


class DecideChangeRequestService:
    def __init__(self, repo: ScheduleChangeRequestRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        request_id: str,
        center_id: str,
        status: str,
        decided_by_member_id: str | None = None,
        decision_note: str | None = None,
    ) -> tuple[ScheduleChangeRequestAtomic, ScheduleChangeRequest]:
        # load
        request = await self.repo.find_by_id(request_id)

        # verify
        if not request:
            raise EntityNotFoundException(f"ScheduleChangeRequest not found: {request_id}")
        if request.center_id != center_id:
            raise PermissionDeniedException("권한이 없는 센터의 변경 요청입니다")
        if request.status != "pending":
            raise ConflictException("이미 처리된 변경 요청이에요")

        # decide
        decided = await self.repo.decide(
            request.id,
            status=status,
            decided_by_member_id=decided_by_member_id,
            decided_at=datetime.now(timezone.utc).replace(tzinfo=None),
            decision_note=decision_note,
        )

        # return
        if status == "approved":
            return ScheduleChangeRequestAtomic.approved(request=decided)
        return ScheduleChangeRequestAtomic.rejected(request=decided)
