from ..events import AssessmentSessionAtomic
from ..models import SessionStatus
from app.core.exceptions import InvalidOperationException
from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class AttendSessionService:
    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        session_id: str,
    ) -> tuple[AssessmentSessionAtomic, AssessmentSession]:
        # load
        session = await self.repo.get_in_center(center_id=center_id, session_id=session_id)

        # verify
        if session.status != SessionStatus.SCHEDULED:
            raise InvalidOperationException(
                f"예약된 세션만 출석 처리할 수 있습니다 (status={session.status})"
            )

        # return
        attended = await self.repo.update_in_center(
            session_id=session_id,
            center_id=center_id,
            status=SessionStatus.ATTENDED,
        )
        return AssessmentSessionAtomic.attended(session=attended)
