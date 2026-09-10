from ..repository import CounselingSessionRepository
from ..models import CounselingSession


class ListSessionsService:
    def __init__(self, session_repo: CounselingSessionRepository):
        self.session_repo = session_repo

    async def execute(
        self,
        case_id: str,
        center_id: str
    ) -> list[CounselingSession]:
        return await self.session_repo.list_by_case(
            case_id=case_id,
            center_id=center_id,
        )
