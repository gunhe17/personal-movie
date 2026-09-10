from ..models import Document
from ..repository import DocumentRepository


class ListDocumentsByFiltersService:
    def __init__(self, repo: DocumentRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        name: str | None = None,
        description: str | None = None,
        file_type: str | None = None,
        uploader_id: str | None = None,
        access_level: str | None = None,
        file_size_from: int | None = None,
        file_size_to: int | None = None,
        limit: int = 50,
    ) -> list[Document]:
        # return
        return await self.repo.list_by_filters(
            center_id=center_id,
            name=name,
            description=description,
            file_type=file_type,
            uploader_id=uploader_id,
            access_level=access_level,
            file_size_from=file_size_from,
            file_size_to=file_size_to,
            limit=limit,
        )
