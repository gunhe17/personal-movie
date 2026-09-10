from ..events import DocumentAtomic
from ..schemas import UploadDocumentCommand
from ..models import Document
from ..repository import DocumentRepository


class UploadDocumentService:
    def __init__(
        self,
        repo: DocumentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        command: UploadDocumentCommand,
        storage_path: str,
    ) -> tuple[DocumentAtomic, Document]:
        # mutate
        document = await self.repo.add(
            center_id=command.center_id,
            uploader_id=command.uploader_id,
            name=command.name,
            original_name=command.original_name,
            description=command.description,
            storage_path=storage_path,
            file_type=command.file_type,
            file_size=command.file_size,
            checksum=command.checksum,
            access_level=command.access_level,
        )

        # return
        return DocumentAtomic.created(document=document)
