from ..events import AssessmentSessionAtomic
from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class RevertCancelSessionsByCaseService:
    def __init__(
        self,
        repo: AssessmentSessionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
    ) -> tuple[list[AssessmentSessionAtomic], list[AssessmentSession]]:
        # persist
        sessions = await self.repo.update_status_by_case(
            case_id=case_id,
            from_status="cancelled",
            to_status="scheduled",
        )

        # return
        atomics = [AssessmentSessionAtomic.reverted(session=s)[0] for s in sessions]
        return atomics, sessions
