from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class FindSessionService:
    def __init__(
        self,
        repo: AssessmentSessionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        session_id: str,
    ) -> AssessmentSession | None:
        # return
        return await self.repo.find_in_center(
            center_id=center_id,
            session_id=session_id,
        )
