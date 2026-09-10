from app.core.type import uuid_str

from ..repository import VoucherExtractionRepository


class DeleteExtractionService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        extraction_id: uuid_str,
    ) -> None:
        # verify
        await self.repo.get_active(id=extraction_id)

        # remove
        await self.repo.remove_by_id(id=extraction_id)
