from ..repository import AssessmentSetRepository
from ..models import AssessmentSet


class ListSetsByIdsService:
    def __init__(self, repo: AssessmentSetRepository):
        self.repo = repo

    async def execute(self, set_ids: list[str]) -> list[AssessmentSet]:
        # return
        return await self.repo.list_by_ids(set_ids=set_ids)
