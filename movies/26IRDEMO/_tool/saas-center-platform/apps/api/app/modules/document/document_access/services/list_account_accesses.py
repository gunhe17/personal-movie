from app.infrastructure.persistence.new_repository import Page

from ..models import DocumentAccess
from ..repository import DocumentAccessRepository


class ListAccountAccessesService:
    def __init__(self, repo: DocumentAccessRepository):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        center_id: str,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[DocumentAccess], Page]:
        # return
        return await self.repo.list_by_account_with_page(
            account_id=account_id,
            center_id=center_id,
            page=page,
            size=size,
        )
