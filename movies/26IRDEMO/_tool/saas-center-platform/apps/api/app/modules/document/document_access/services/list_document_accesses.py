from app.infrastructure.persistence.new_repository import Page

from ..models import DocumentAccess
from ..repository import DocumentAccessRepository


class ListDocumentAccessesService:
    def __init__(self, repo: DocumentAccessRepository):
        self.repo = repo

    async def execute(
        self,
        document_id: str,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[DocumentAccess], Page]:
        # return
        return await self.repo.list_by_document_with_page(
            document_id=document_id,
            page=page,
            size=size,
        )
