from app.core.datetime_utils import utc_now

from ..models import VoucherExtraction, VoucherExtractionStatus
from ..repository import VoucherExtractionRepository


class CreateExtractionService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        source_document_ids: list[str],
        completed: dict,
    ) -> VoucherExtraction:
        # return
        return await self.repo.add(
            status=VoucherExtractionStatus.PROCESSING,
            started_at=utc_now(),
            source_document_ids=source_document_ids,
            artifact_document_ids=[],
            completed=completed,
            progress={"stage": "route"},
        )
