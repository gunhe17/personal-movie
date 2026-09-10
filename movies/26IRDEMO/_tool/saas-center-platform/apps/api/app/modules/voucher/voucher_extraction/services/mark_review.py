from app.core.type import uuid_str

from ..models import VoucherExtraction, VoucherExtractionStatus
from ..repository import VoucherExtractionRepository


class MarkReviewService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        extraction_id: uuid_str,
    ) -> VoucherExtraction | None:
        return await self.repo.update_in_place(
            id=extraction_id,
            status=VoucherExtractionStatus.REVIEW,
        )
