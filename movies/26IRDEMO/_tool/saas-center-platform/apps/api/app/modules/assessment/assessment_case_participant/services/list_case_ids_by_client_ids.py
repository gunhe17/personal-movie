from ..repository import AssessmentCaseParticipantRepository


class ListCaseIdsByClientIdsService:
    def __init__(self, repo: AssessmentCaseParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_ids: list[str],
    ) -> list[str]:
        # return
        return await self.repo.list_case_ids_by_client_ids(
            center_id=center_id,
            client_ids=client_ids,
        )
