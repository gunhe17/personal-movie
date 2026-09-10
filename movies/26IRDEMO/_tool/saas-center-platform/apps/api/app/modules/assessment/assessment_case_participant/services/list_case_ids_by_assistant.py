from ..repository import AssessmentCaseParticipantRepository


class ListCaseIdsByAssistantService:
    def __init__(
        self,
        repo: AssessmentCaseParticipantRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        member_id: str,
    ) -> list[str]:
        # return
        return await self.repo.list_case_ids_by_assistant(
            center_id=center_id,
            member_id=member_id,
        )
