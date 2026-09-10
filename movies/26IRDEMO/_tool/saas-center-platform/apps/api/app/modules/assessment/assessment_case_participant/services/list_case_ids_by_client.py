from ..repository import AssessmentCaseParticipantRepository


class ListCaseIdsByClientService:
    def __init__(
        self,
        repo: AssessmentCaseParticipantRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_id: str,
        *,
        active_only: bool = True,
    ) -> list[str]:
        # return
        return await self.repo.list_case_ids_by_client(
            center_id=center_id,
            client_id=client_id,
            active_only=active_only,
        )
