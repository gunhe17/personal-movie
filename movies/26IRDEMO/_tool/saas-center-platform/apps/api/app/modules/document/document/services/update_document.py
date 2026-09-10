from app.core.type import unset

from ..models import Document
from ..repository import DocumentRepository
from ..events import DocumentAtomic


class UpdateDocumentService:
    def __init__(
        self,
        repo: DocumentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        document_id: str,
        center_id: str,
        *,
        changed: dict,
        name: str = unset,
        description: str | None = unset,
        file_type: str = unset,
        file_size: int = unset,
        checksum: str = unset,
        access_level: str = unset,
        storage_path: str = unset,
    ) -> tuple[DocumentAtomic, Document]:
        # load
        document = await self.repo.get_in_center(
            document_id=document_id, center_id=center_id,
        )

        # verify
        # update
        fields = {
            k: v
            for k, v in {
                "name": name,
                "description": description,
                "file_type": file_type,
                "file_size": file_size,
                "checksum": checksum,
                "access_level": access_level,
                "storage_path": storage_path,
            }.items()
            if v is not unset
        }
        if fields:
            document = await self.repo.update_in_center(
                id=document_id,
                center_id=center_id,
                **fields,
            )

        # return
        return DocumentAtomic.updated(document=document, changed=changed)
