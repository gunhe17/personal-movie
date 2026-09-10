from app.core.type import uuid_str

from ..models import VoucherExtraction
from ..repository import VoucherExtractionRepository


class FindExtractionService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        extraction_id: uuid_str,
    ) -> VoucherExtraction | None:
        # return (삭제분 포함 — 재시도·감사 경로)
        return await self.repo.find_by_id_all_states(id=extraction_id)
