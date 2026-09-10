from ..models import Document
from ..repository import DocumentRepository


class GetDocumentsByIdsService:
    def __init__(self, repo: DocumentRepository):
        self.repo = repo

    async def execute(
        self,
        document_ids: list[str],
        center_id: str,
    ) -> list[Document]:
        # return
        return await self.repo.list_by_ids(
            document_ids=document_ids,
            center_id=center_id,
        )
