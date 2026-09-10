from ..events import CounselingSessionAtomic
from ..repository import CounselingSessionRepository
from ..models import CounselingSession


class DeleteSessionService:
    def __init__(self, session_repo: CounselingSessionRepository):
        self.session_repo = session_repo

    async def execute(
        self,
        session_id: str,
        center_id: str
    ) -> tuple[CounselingSessionAtomic, CounselingSession]:
        # load
        session = await self.session_repo.get_in_center(
            session_id=session_id,
            center_id=center_id,
        )

        # remove
        await self.session_repo.remove_by_id(id=session.id)

        return CounselingSessionAtomic.deleted(session=session)
