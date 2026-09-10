from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.range import to_range

from ..models import FormExtraction, FormExtractionStatus
from ..repository import FormExtractionRepository


class CreateFormExtractionService:
    def __init__(self, repo: FormExtractionRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        name: str,
        center_id: str | None,
        source_document_id: str,
        page_range: tuple[int, int] | None = None,
    ) -> FormExtraction:
        # return
        return await self.repo.add(
            status=FormExtractionStatus.PROCESSING,
            name=name,
            center_id=center_id,
            started_at=utc_now(),
            source_document_id=source_document_id,
            page_range=to_range(page_range),
        )
