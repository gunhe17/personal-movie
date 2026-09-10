from app.modules.counseling.counseling_session.models import CounselingSessionStatus
from app.modules.counseling.counseling_session.repository import CounselingSessionRepository


class ListCompletedCaseSessionsService:
    def __init__(
        self,
        repo: CounselingSessionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
    ) -> list:
        sessions = await self.repo.list_by_case_ids(case_ids=[case_id])
        completed = [
            s for s in sessions
            if s.status == CounselingSessionStatus.COMPLETED and s.deleted_at is None
        ]
        completed.sort(key=lambda s: s.session_number or 0)
        return completed
