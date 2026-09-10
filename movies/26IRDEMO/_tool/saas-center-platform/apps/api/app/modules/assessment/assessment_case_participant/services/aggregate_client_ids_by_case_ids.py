from ..repository import AssessmentCaseParticipantRepository


class AggregateClientIdsByCaseIdsService:
    # participant_type='client', unassigned_at=None, deleted_at=None인 것만 포함.

    def __init__(self, repo: AssessmentCaseParticipantRepository):
        self.repo = repo

    async def execute(self, case_ids: list[str]) -> dict[str, list[str]]:
        if not case_ids:
            return {}

        return await self.repo.aggregate_client_ids_by_case_ids(case_ids=case_ids)
