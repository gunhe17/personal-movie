from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.extraction.models import FormExtraction
from app.modules.form.extraction.repository import FormExtractionRepository
from app.modules.form.extraction.services import (
    FindFormExtractionService,
    MarkCompletedService,
    MarkFailedService,
    SetImageDocumentService,
)


class FormExtractionFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    def _repo(self) -> FormExtractionRepository:
        return self._uow.repo(FormExtractionRepository)

    async def find_extraction(self, extraction_id: str) -> FormExtraction | None:
        return await FindFormExtractionService(self._repo()).execute(extraction_id)

    async def set_image_document(
        self,
        *,
        extraction_id: str,
        image_document_id: str,
    ) -> FormExtraction:
        return await SetImageDocumentService(self._repo()).execute(
            extraction_id=extraction_id,
            image_document_id=image_document_id,
        )

    async def mark_extraction_completed(
        self,
        *,
        extraction_id: str,
        completed: dict,
    ) -> FormExtraction:
        return await MarkCompletedService(self._repo()).execute(
            extraction_id=extraction_id,
            completed=completed,
        )

    async def mark_extraction_failed(
        self,
        extraction_id: str,
        reason: str,
    ) -> bool:
        marked = await MarkFailedService(self._repo()).execute(
            extraction_id=extraction_id,
            reason=reason,
        )
        return marked is not None
