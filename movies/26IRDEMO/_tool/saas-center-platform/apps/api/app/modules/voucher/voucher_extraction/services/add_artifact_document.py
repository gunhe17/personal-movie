from app.core.type import uuid_str

from ..models import VoucherExtraction
from ..repository import VoucherExtractionRepository


class AddArtifactDocumentService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        extraction_id: uuid_str,
        document_id: uuid_str,
    ) -> VoucherExtraction:
        # read
        extraction = await self.repo.get_for_update(id=extraction_id)

        # append — 중복 방지
        artifacts = list(extraction.artifact_document_ids or [])
        if document_id in artifacts:
            return extraction
        artifacts.append(document_id)

        # return
        return await self.repo.update_in_place(
            id=extraction_id,
            artifact_document_ids=artifacts,
        )
