from ..repository import AssessmentCaseParticipantRepository


class ListAllClientIdsByCaseIdsService:
    def __init__(
        self,
        repo: AssessmentCaseParticipantRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        case_ids: list[str],
    ) -> list[str]:
        # return
        return await self.repo.list_all_client_ids_by_case_ids(case_ids=case_ids)
