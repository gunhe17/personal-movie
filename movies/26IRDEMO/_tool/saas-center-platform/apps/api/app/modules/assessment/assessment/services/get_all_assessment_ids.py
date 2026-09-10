from ..repository import AssessmentRepository


class GetAllAssessmentIdsService:
    def __init__(self, repo: AssessmentRepository):
        self.repo = repo

    async def execute(self) -> list[str]:
        return await self.repo.list_all_ids()
