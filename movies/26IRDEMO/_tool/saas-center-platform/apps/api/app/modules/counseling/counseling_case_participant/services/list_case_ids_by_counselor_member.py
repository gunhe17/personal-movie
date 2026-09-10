from ..repository import CounselingCaseParticipantRepository


class ListCaseIdsByCounselorMemberService:
    def __init__(self, repo: CounselingCaseParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        member_id: str,
        *,
        active_only: bool = False,
    ) -> list[str]:
        # return
        return await self.repo.list_case_ids_by_counselor_member(
            center_id=center_id,
            member_id=member_id,
            active_only=active_only,
        )
