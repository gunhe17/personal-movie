from ..repository import AssessmentSessionParticipantRepository


class RemoveParticipantsBySessionIdsService:
    def __init__(
        self,
        repo: AssessmentSessionParticipantRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        session_ids: list[str],
    ) -> int:
        # return
        return await self.repo.remove_by_session_ids(session_ids=session_ids)
