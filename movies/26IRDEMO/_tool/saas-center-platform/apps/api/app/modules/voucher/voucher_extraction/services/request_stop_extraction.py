from app.core.type import uuid_str

from ..repository import VoucherExtractionRepository


class RequestStopExtractionService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        extraction_id: uuid_str,
    ) -> bool:
        # status 전이만 — 돌던 청크는 끝까지 가서 커밋되고, 실행자가 다음 경계에서 멈춘다
        return await self.repo.pause_if_processing(id=extraction_id)
