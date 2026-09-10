from ..repository import CounselingCaseRepository
from ..models import CounselingCase


class GetCounselingCaseService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
        center_id: str,
        counselor_id: str | None
    ) -> CounselingCase:
        # load
        case = await self.repo.get_in_center(
            case_id=case_id,
            center_id=center_id,
            counselor_id=counselor_id,
        )

        # return
        return case
