from ..models import LinkRequestStatus
from app.infrastructure.persistence.new_repository import Page

from ..repository import ClientLinkRequestRepository
from ..models import ClientLinkRequest


class ListLinkRequestsService:
    def __init__(self, repo: ClientLinkRequestRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        owner_scope: str | None,
        status: str | None = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[ClientLinkRequest], Page]:
        if owner_scope is None:
            return await self.repo.list_in_center_with_page(
                center_id=center_id,
                status=status,
                skip=skip,
                limit=limit,
            )

        # access_level=own → pending만 조회 가능 (처리 대상만)
        return await self.repo.list_in_center_with_page(
            center_id=center_id,
            status=LinkRequestStatus.PENDING,
            skip=skip,
            limit=limit,
        )
