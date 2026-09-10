from ..models import SessionStatus
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentSessionAtomic
from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class RevertCancelSessionService:
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
        if session.status != SessionStatus.CANCELLED:
            raise InvalidOperationException("취소된 세션만 되돌릴 수 있습니다")

        # mutate
        session = await self.repo.update_in_center(
            session_id=session_id,
            center_id=center_id,
            status=SessionStatus.SCHEDULED,
            cancel_reason=None,
        )
        return AssessmentSessionAtomic.reverted(session=session)
