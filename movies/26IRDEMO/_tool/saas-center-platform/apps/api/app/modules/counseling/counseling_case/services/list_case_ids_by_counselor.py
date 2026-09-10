from ..repository import CounselingCaseRepository


class ListCaseIdsByCounselorService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        counselor_id: str,
    ) -> list[str]:
        return await self.repo.list_all_case_ids_by_counselor(
            center_id=center_id,
            counselor_id=counselor_id,
        )
