from ..models import ProgramMember
from ..repository import ProgramMemberRepository


class ListProgramMembersService:
    def __init__(self, repo: ProgramMemberRepository):
        self.repo = repo

    async def execute(
        self,
        program_id: str,
    ) -> list[ProgramMember]:
        # return
        return await self.repo.list_by_program(program_id=program_id)
