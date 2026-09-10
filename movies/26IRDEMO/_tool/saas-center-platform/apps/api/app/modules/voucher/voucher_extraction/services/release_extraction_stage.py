from app.core.type import uuid_str

from ..repository import VoucherExtractionRepository


class ReleaseExtractionStageService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        extraction_id: uuid_str,
        *,
        stage: str,
    ) -> None:
        await self.repo.release_stage(id=extraction_id, stage=stage)
