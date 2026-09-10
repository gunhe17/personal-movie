from ..repository import CounselingCaseRepository


class ListCaseIdsByCounselorFieldService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        counselor_id: str,
    ) -> list[str]:
        # return
        return await self.repo.list_case_ids_by_counselor_field(
            center_id=center_id,
            counselor_id=counselor_id,
        )
