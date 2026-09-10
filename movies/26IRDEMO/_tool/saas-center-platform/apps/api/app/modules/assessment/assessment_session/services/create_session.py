from ..models import SessionStatus
from ..events import AssessmentSessionAtomic
from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class CreateSessionService:
    # Session Participant 초기화는 여기서 안 함 — 별도 InitializeSessionParticipantsService를 handler가 조합

    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
        schedule_id: str | None = None,
    ) -> tuple[AssessmentSessionAtomic, AssessmentSession]:
        # return
        session = await self.repo.add(
            center_id=center_id,
            case_id=case_id,
            schedule_id=schedule_id,
            status=SessionStatus.SCHEDULED,
        )
        return AssessmentSessionAtomic.created(session=session)
