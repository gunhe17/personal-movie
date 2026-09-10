from app.core.exceptions import (
    InvalidOperationException,
)
from ..models import Document
from ..repository import DocumentRepository
from ..events import DocumentAtomic


class RestoreDocumentService:
    def __init__(self, repo: DocumentRepository):
        self.repo = repo

    async def execute(self, document_id: str, center_id: str) -> tuple[DocumentAtomic, Document]:
        # load
        document = await self.repo.get_in_center_including_deleted(
            document_id=document_id, center_id=center_id,
        )

        # verify
        if not document.deleted_at:
            raise InvalidOperationException(f"Document is not deleted: {document_id}")

        # mutate
        restored = await self.repo.restore_by_id(id=document_id)
        assert restored is not None

        # return
        return DocumentAtomic.restored(document=restored)
