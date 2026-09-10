from datetime import datetime

from ..repository import CounselingSessionRepository


class AggregateCompletedSessionsByCaseIdsService:
    def __init__(
        self,
        repo: CounselingSessionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        case_ids: list[str],
    ) -> tuple[int, datetime | None]:
        # return
        return await self.repo.aggregate_completed_by_case_ids(case_ids=case_ids)
