from ..repository import CounselingCaseParticipantRepository


class AggregateActiveCounselorsByCaseIdsService:
    def __init__(self, repository: CounselingCaseParticipantRepository):
        self.repository = repository

    async def execute(self, case_ids: list[str]) -> dict[str, list[str]]:
        if not case_ids:
            return {}

        return await self.repository.aggregate_active_counselors_by_case_ids(case_ids=case_ids)
