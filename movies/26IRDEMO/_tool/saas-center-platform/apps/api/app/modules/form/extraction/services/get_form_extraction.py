from ..models import FormExtraction
from ..repository import FormExtractionRepository


class GetFormExtractionService:
    def __init__(self, repo: FormExtractionRepository):
        self.repo = repo

    async def execute(self, extraction_id: str) -> FormExtraction:
        # return
        return await self.repo.get_by_id(extraction_id)
