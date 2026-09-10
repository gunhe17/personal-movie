from ..repository import CounselingSessionRepository
from ..models import CounselingSession


class GetSessionsByIdsService:
    def __init__(self, repository: CounselingSessionRepository):
        self.repository = repository

    async def execute(
        self,
        session_ids: list[str],
        center_id: str,
    ) -> list[CounselingSession]:
        return await self.repository.list_by_ids_in_center(
            session_ids=session_ids,
            center_id=center_id,
        )
