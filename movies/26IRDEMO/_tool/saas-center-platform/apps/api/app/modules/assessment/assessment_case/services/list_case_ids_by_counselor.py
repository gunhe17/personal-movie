from ..repository import AssessmentCaseRepository


class ListCaseIdsByCounselorService:
    def __init__(
        self,
        repo: AssessmentCaseRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        counselor_id: str,
    ) -> list[str]:
        # return
        return await self.repo.list_ids_by_counselor(
            center_id=center_id,
            counselor_id=counselor_id,
        )
