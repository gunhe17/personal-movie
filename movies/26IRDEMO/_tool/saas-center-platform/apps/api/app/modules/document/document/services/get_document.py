
from ..models import Document
from ..repository import DocumentRepository


class GetDocumentService:
    def __init__(self, repo: DocumentRepository):
        self.repo = repo

    async def execute(
        self,
        document_id: str,
        center_id: str,
        include_deleted: bool = False,
    ) -> Document:
        # load
        if include_deleted:
            document = await self.repo.get_in_center_including_deleted(
                document_id=document_id, center_id=center_id,
            )
        else:
            document = await self.repo.get_in_center(
                document_id=document_id, center_id=center_id,
            )

        # verify
        # return
        return document
