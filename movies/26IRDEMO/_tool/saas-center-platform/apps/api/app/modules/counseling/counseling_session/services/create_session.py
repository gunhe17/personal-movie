from app.modules.counseling.counseling_session.models import CounselingSessionStatus
from app.core.exceptions import ConflictException
from ..events import CounselingSessionAtomic
from ..repository import CounselingSessionRepository
from ..models import CounselingSession


class CreateSessionService:
    def __init__(self, session_repo: CounselingSessionRepository):
        self.session_repo = session_repo

    async def execute(
        self,
        *,
        center_id: str,
        counseling_case_id: str,
        schedule_id: str,
        session_number: int,
    ) -> tuple[CounselingSessionAtomic, CounselingSession]:
        # verify
        existing_session = await self.session_repo.find_by_schedule(
            schedule_id=schedule_id,
            center_id=center_id,
        )
        if existing_session:
            raise ConflictException(
                f"Schedule already linked to a session: {schedule_id}"
            )

        # return
        session = await self.session_repo.add(
            center_id=center_id,
            counseling_case_id=counseling_case_id,
            schedule_id=schedule_id,
            status=CounselingSessionStatus.SCHEDULED,
            session_number=session_number,
            completed_at=None,
        )
        return CounselingSessionAtomic.created(session=session)
