from app.core.exceptions import ConflictException
from app.core.type import utc_dt

from ..events import ClientLinkRequestAtomic
from ..repository import ClientLinkRequestRepository
from ..models import ClientLinkRequest


class CreateLinkRequestService:
    def __init__(
        self,
        repo: ClientLinkRequestRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        person_id: str,
        phone: str,
        requested_at: utc_dt,
    ) -> tuple[ClientLinkRequestAtomic, ClientLinkRequest]:
        # verify
        exists = await self.repo.exists_pending_request(
            person_id=person_id,
            center_id=center_id,
        )
        if exists:
            raise ConflictException(
                f"Person {person_id}의 대기 중인 연동 요청이 이미 존재합니다"
            )

        # return
        request = await self.repo.add(
            center_id=center_id,
            person_id=person_id,
            phone=phone,
            requested_at=requested_at,
        )
        return ClientLinkRequestAtomic.created(request=request)
