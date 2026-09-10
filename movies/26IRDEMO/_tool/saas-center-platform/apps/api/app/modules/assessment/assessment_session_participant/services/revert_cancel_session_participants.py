from ..repository import AssessmentSessionParticipantRepository


class RevertCancelSessionParticipantsService:
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
        return await self.repo.update_attendance_to_scheduled(session_ids=session_ids)
