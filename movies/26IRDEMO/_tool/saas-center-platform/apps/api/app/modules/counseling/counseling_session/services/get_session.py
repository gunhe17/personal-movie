from ..repository import CounselingSessionRepository
from ..models import CounselingSession


class GetSessionService:
    def __init__(self, session_repo: CounselingSessionRepository):
        self.session_repo = session_repo

    async def execute(
        self,
        session_id: str,
        center_id: str
    ) -> CounselingSession:
        # load
        session = await self.session_repo.get_in_center(
            session_id=session_id,
            center_id=center_id,
        )

        return session
