from ..repository import CounselingCaseRepository


class AggregateCasesByCounselorSummaryService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        counselor_id: str,
    ) -> list[tuple[str, str]]:
        # return
        return await self.repo.aggregate_all_by_counselor_summary(
            center_id=center_id,
            counselor_id=counselor_id,
        )
