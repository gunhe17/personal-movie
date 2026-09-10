from app.core.type import uuid_str

from ..models import VoucherExtraction
from ..repository import VoucherExtractionRepository


class GetExtractionService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        extraction_id: uuid_str,
    ) -> VoucherExtraction:
        # return
        return await self.repo.get_active(id=extraction_id)
