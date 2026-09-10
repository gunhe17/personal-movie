from ..repository import CounselingCaseParticipantRepository


class ListCaseIdsByParticipantIdsService:
    def __init__(self, repo: CounselingCaseParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        participant_ids: list[str],
        center_id: str,
    ) -> list[str]:
        return await self.repo.list_case_ids_by_participant_ids(
            participant_ids=participant_ids,
            center_id=center_id,
        )
