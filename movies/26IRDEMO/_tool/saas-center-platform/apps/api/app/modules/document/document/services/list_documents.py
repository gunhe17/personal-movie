from app.infrastructure.persistence.new_repository import Page

from ..models import Document
from ..repository import DocumentRepository


class ListDocumentsService:
    def __init__(self, repo: DocumentRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        owner_scope: str | None,
        page: int = 1,
        size: int = 20,
        include_deleted: bool = False,
    ) -> tuple[list[Document], Page]:
        # return
        if include_deleted:
            return await self.repo.list_in_center_with_page_including_deleted(
                center_id=center_id,
                uploader_id=owner_scope,
                page=page,
                size=size,
            )
        return await self.repo.list_in_center_with_page(
            center_id=center_id,
            uploader_id=owner_scope,
            page=page,
            size=size,
        )
