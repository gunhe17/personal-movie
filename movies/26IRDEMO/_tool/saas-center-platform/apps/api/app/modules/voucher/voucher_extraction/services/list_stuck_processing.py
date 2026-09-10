from app.core.type import utc_dt

from ..models import VoucherExtraction
from ..repository import VoucherExtractionRepository


class ListStuckProcessingService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        stale_before: utc_dt,
    ) -> list[VoucherExtraction]:
        # return
        return await self.repo.list_stuck_processing(stale_before=stale_before)
