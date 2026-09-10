from app.core.type import uuid_str

from ..models import VoucherExtraction
from ..repository import VoucherExtractionRepository


class ResumeExtractionService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        extraction_id: uuid_str,
    ) -> VoucherExtraction:
        # progress.data 는 건드리지 않는다 — 멈춘 지점 그대로 이어간다
        await self.repo.clear_stop(id=extraction_id)
        return await self.repo.get_active(id=extraction_id)
