from ..events import ProgramAtomic
from ..models import Program
from ..repository import ProgramRepository


class DeleteProgramService:
    def __init__(self, repo: ProgramRepository):
        self.repo = repo

    async def execute(
        self,
        program_id: str,
        center_id: str,
    ) -> tuple[ProgramAtomic, Program]:
        # verify
        program = await self.repo.get_in_center(program_id=program_id, center_id=center_id)

        # delete
        await self.repo.remove_by_id(id=program_id)
        return ProgramAtomic.deleted(program=program)
