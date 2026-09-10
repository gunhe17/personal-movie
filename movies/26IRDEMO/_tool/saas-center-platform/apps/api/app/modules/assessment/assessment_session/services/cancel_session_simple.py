from ..models import SessionStatus
from ..events import AssessmentSessionAtomic
from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class CancelSessionSimpleService:
    def __init__(
        self,
        repo: AssessmentSessionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        session_id: str,
    ) -> tuple[AssessmentSessionAtomic | None, AssessmentSession | None]:
        # persist (부재/삭제 = None — 호출자가 스킵)
        session = await self.repo.update_in_place(
            session_id, status=SessionStatus.CANCELLED
        )
        if session is None:
            return None, None

        # return
        return AssessmentSessionAtomic.cancelled(session=session)
