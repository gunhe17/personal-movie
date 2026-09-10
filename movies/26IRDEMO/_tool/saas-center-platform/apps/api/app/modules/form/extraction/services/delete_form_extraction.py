from ..repository import FormExtractionRepository


class DeleteFormExtractionService:
    def __init__(self, repo: FormExtractionRepository):
        self.repo = repo

    async def execute(self, extraction_id: str) -> None:
        # verify (부재 = 404)
        await self.repo.get_by_id(extraction_id)

        # delete
        await self.repo.remove_by_id(extraction_id)
