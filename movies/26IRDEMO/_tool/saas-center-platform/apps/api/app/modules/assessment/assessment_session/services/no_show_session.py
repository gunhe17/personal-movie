from ..models import SessionStatus
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentSessionAtomic
from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class NoShowSessionService:
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
                f"예약된 세션만 노쇼 처리할 수 있습니다 (status={session.status})"
            )

        # mutate
        session = await self.repo.update_in_center(
            session_id=session_id,
            center_id=center_id,
            status=SessionStatus.NO_SHOW,
        )
        return AssessmentSessionAtomic.no_show(session=session)
