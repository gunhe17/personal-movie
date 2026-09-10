from ..models import CounselingSession
from ..repository import CounselingSessionRepository


class ListSessionsByScheduleAndCaseIdsService:
    def __init__(self, repo: CounselingSessionRepository):
        self.repo = repo

    async def execute(
        self,
        case_ids: list[str],
        schedule_ids: list[str],
    ) -> list[CounselingSession]:
        return await self.repo.list_by_schedule_ids_and_case_ids(
            case_ids=case_ids,
            schedule_ids=schedule_ids,
        )
