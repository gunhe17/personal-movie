from app.core.exceptions import EntityNotFoundException, PermissionDeniedException

from ..models import ScheduleChangeRequest
from ..repository import ScheduleChangeRequestRepository


class GetChangeRequestService:
    def __init__(self, repo: ScheduleChangeRequestRepository):
        self.repo = repo

    async def execute(self, *, request_id: str, center_id: str) -> ScheduleChangeRequest:
        # load
        request = await self.repo.find_by_id(request_id)

        # verify
        if not request:
            raise EntityNotFoundException(f"ScheduleChangeRequest not found: {request_id}")
        if request.center_id != center_id:
            raise PermissionDeniedException("권한이 없는 센터의 변경 요청입니다")

        # return
        return request
