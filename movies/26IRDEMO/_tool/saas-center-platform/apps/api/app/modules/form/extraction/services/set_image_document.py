from app.core.type import uuid_str

from ..models import FormExtraction
from ..repository import FormExtractionRepository


class SetImageDocumentService:
    def __init__(
        self,
        repo: FormExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        extraction_id: uuid_str,
        image_document_id: uuid_str,
    ) -> FormExtraction:
        # return
        return await self.repo.update_in_place(
            id=extraction_id,
            image_document_id=image_document_id,
        )
