from ..repository import CounselingCaseRepository
from ..models import CounselingCase


class FindCounselingCaseService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
        center_id: str,
    ) -> CounselingCase | None:
        # return
        return await self.repo.find_in_center(case_id=case_id, center_id=center_id)
