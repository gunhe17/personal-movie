from ..models import SessionStatus
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentSessionAtomic
from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class CancelSessionService:
    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(self, center_id: str, session_id: str, cancel_reason: str | None = None) -> tuple[AssessmentSessionAtomic, AssessmentSession]:
        # load
        session = await self.repo.get_in_center(center_id=center_id, session_id=session_id)

        # verify
        if session.status == SessionStatus.ATTENDED:
            raise InvalidOperationException(
                "출석 완료된 세션은 취소할 수 없습니다"
            )

        # return
        cancelled = await self.repo.update_in_center(
            session_id=session_id,
            center_id=center_id,
            status=SessionStatus.CANCELLED,
            cancel_reason=cancel_reason,
        )
        return AssessmentSessionAtomic.cancelled(session=cancelled)
