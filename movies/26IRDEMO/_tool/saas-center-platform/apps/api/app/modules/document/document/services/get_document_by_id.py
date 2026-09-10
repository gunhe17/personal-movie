from ..models import Document
from ..repository import DocumentRepository


class GetDocumentByIdService:
    def __init__(self, repo: DocumentRepository):
        self.repo = repo

    async def execute(
        self,
        document_id: str,
        include_deleted: bool = False,
    ) -> Document:
        # return
        if include_deleted:
            return await self.repo.get_by_id_including_deleted(document_id=document_id)
        return await self.repo.get_by_id(document_id)
