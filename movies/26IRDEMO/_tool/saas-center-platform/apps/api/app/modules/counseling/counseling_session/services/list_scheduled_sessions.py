from app.modules.counseling.counseling_session.models import CounselingSessionStatus
from ..repository import CounselingSessionRepository
from ..models import CounselingSession


class ListScheduledSessionsService:
    def __init__(self, session_repo: CounselingSessionRepository):
        self.session_repo = session_repo

    async def execute(self, case_id: str) -> list[CounselingSession]:
        return await self.session_repo.list_by_case_and_status(
            case_id=case_id,
            status=CounselingSessionStatus.SCHEDULED,
        )
