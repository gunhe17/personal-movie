from ..models import Program
from ..repository import ProgramRepository


class ListProgramsByNameService:
    def __init__(self, repo: ProgramRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        name: str,
    ) -> list[Program]:
        # return
        return await self.repo.list_by_name(
            center_id=center_id,
            name=name,
        )
