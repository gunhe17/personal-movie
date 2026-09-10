from ..models import Document
from ..repository import DocumentRepository
from ..events import DocumentAtomic


class DeleteDocumentService:
    def __init__(self, repo: DocumentRepository):
        self.repo = repo

    async def execute(self, document_id: str, center_id: str) -> tuple[DocumentAtomic, Document]:
        # load
        document = await self.repo.get_in_center(
            document_id=document_id, center_id=center_id,
        )

        # verify
        # mutate
        removed = await self.repo.remove_by_id(id=document_id)
        assert removed is not None

        # return
        return DocumentAtomic.deleted(document=removed)
