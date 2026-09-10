from ..events import ClientLinkRequestAtomic
from ..models import LinkRequestStatus
from app.core.exceptions import EntityNotFoundException, ConflictException
from ..repository import ClientLinkRequestRepository
from ..models import ClientLinkRequest
from app.core.datetime_utils import utc_now


class RejectLinkRequestService:
    def __init__(
        self,
        repo: ClientLinkRequestRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        request_id: str,
        center_id: str,
    ) -> tuple[ClientLinkRequestAtomic, ClientLinkRequest]:
        # load
        request = await self.repo.get_in_center(id=request_id, center_id=center_id)

        # verify
        if request.status != LinkRequestStatus.PENDING:
            raise ConflictException(f"이미 처리된 요청입니다 (상태: {request.status})")

        # update
        update_data = {
            "status": LinkRequestStatus.REJECTED,
            "reviewed_at": utc_now()
        }
        rejected_request = await self.repo.update_in_place(request_id, **update_data)

        if not rejected_request:
            raise EntityNotFoundException(f"연동 요청 {request_id} 거부에 실패했습니다")

        return ClientLinkRequestAtomic.rejected(request=rejected_request)
