from ..repository import CounselingCaseRepository
from ..models import CounselingCase


class FindRecentDuplicateCaseService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        program_id: str,
        counselor_id: str,
        minutes_threshold: int,
    ) -> CounselingCase | None:
        # return
        return await self.repo.find_recent_duplicate(
            center_id=center_id,
            program_id=program_id,
            counselor_id=counselor_id,
            minutes_threshold=minutes_threshold,
        )
