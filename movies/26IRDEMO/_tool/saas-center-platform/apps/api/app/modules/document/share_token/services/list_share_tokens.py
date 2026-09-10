from app.infrastructure.persistence.new_repository import Page

from ..models import ShareToken
from ..repository import ShareTokenRepository


class ListShareTokensService:
    def __init__(self, repo: ShareTokenRepository):
        self.repo = repo

    async def execute(
        self,
        document_id: str,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[ShareToken], Page]:
        # return
        return await self.repo.list_by_document_with_page(
            document_id=document_id,
            page=page,
            size=size,
        )
