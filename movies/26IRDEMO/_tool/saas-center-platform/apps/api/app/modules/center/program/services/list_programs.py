from ..repository import ProgramRepository
from ..models import Program


class ListProgramsService:
    def __init__(self, repo: ProgramRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[Program], int]:
        # load
        programs = await self.repo.list_by_center(
            center_id=center_id,
            skip=skip,
            limit=limit,
        )
        total = await self.repo.count_by_center(center_id=center_id)

        # return
        return programs, total
