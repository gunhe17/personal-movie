from ..models import FormExtraction
from ..repository import FormExtractionRepository


class FindFormExtractionService:
    def __init__(
        self,
        repo: FormExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        extraction_id: str,
    ) -> FormExtraction | None:
        # return
        return await self.repo.find_by_id(id=extraction_id)
