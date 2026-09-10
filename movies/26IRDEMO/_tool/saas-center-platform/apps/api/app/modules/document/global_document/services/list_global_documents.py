from app.infrastructure.persistence.new_repository import Page

from ..models import GlobalDocument
from ..repository import GlobalDocumentRepository


class ListGlobalDocumentsService:
    def __init__(self, repo: GlobalDocumentRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        q: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[GlobalDocument], Page]:
        # return
        return await self.repo.list_with_filters_with_page(q=q, page=page, size=size)
