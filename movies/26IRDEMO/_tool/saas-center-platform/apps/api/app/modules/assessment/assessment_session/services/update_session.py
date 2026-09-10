from ..events import AssessmentSessionAtomic
from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class UpdateSessionService:
    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        session_id: str,
        changed: dict,
        status: str | None = None,
    ) -> tuple[AssessmentSessionAtomic, AssessmentSession]:
        # load
        session = await self.repo.get_in_center(center_id=center_id, session_id=session_id)

        # return
        if status:
            updated = await self.repo.update_in_center(
                session_id=session_id,
                center_id=center_id,
                status=status,
            )
            if updated is not None:
                session = updated

        return AssessmentSessionAtomic.updated(session=session, changed=changed)
