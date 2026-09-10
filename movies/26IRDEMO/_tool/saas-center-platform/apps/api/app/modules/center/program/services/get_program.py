from ..repository import ProgramRepository
from ..models import Program


class GetProgramService:
    def __init__(self, repo: ProgramRepository):
        self.repo = repo

    async def execute(
        self,
        program_id: str,
        center_id: str,
    ) -> Program:
        # load
        program = await self.repo.get_in_center(program_id=program_id, center_id=center_id)

        # return
        return program
