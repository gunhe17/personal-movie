from ..repository import ProgramRepository
from ..models import Program


class GetProgramsByIdsService:
    def __init__(self, repo: ProgramRepository):
        self.repo = repo

    async def execute(self, program_ids: list[str]) -> dict[str, Program]:
        if not program_ids:
            return {}

        programs = await self.repo.list_by_ids(program_ids=program_ids)
        return {program.id: program for program in programs}
