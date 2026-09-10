from ..repository import CounselingSessionRepository
from ..models import CounselingSession


class ListSessionsByFiltersService:
    def __init__(self, repo: CounselingSessionRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str | None = None,
        status: str | None = None,
        schedule_id: str | None = None,
        schedule_ids: list[str] | None = None,
        session_number_min: int | None = None,
        session_number_max: int | None = None,
        limit: int = 50,
    ) -> list[CounselingSession]:
        return await self.repo.list_filtered(
            center_id=center_id,
            case_id=case_id,
            status=status,
            schedule_id=schedule_id,
            schedule_ids=schedule_ids,
            session_number_min=session_number_min,
            session_number_max=session_number_max,
            limit=limit,
        )
