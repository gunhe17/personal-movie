from ..events import ProgramMemberAtomic
from ..models import ProgramMember
from ..repository import ProgramMemberRepository


class UnassignMemberService:
    def __init__(self, repo: ProgramMemberRepository):
        self.repo = repo

    async def execute(
        self,
        program_id: str,
        member_id: str,
        center_id: str,
    ) -> tuple[ProgramMemberAtomic, ProgramMember]:
        # load
        pm = await self.repo.get_in_center(
            program_id=program_id,
            member_id=member_id,
            center_id=center_id,
        )

        # remove
        await self.repo.remove_by_id(pm.id)

        # return
        return ProgramMemberAtomic.unassigned(program_member=pm)
