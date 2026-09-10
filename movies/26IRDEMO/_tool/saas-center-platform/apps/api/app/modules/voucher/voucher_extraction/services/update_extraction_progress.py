from app.core.type import uuid_str

from ..repository import VoucherExtractionRepository


class UpdateExtractionProgressService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        extraction_id: uuid_str,
        *,
        progress: dict,
    ) -> None:
        # {stage, data} 등을 통째로 교체 — 호출자가 병합해서 넘긴다.
        await self.repo.update_in_place(id=extraction_id, progress=progress)
