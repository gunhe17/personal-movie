from ..repository import ProgramRepository


class ListProgramIdsByTypeService:
    def __init__(self, repo: ProgramRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        program_type: str,
    ) -> list[str]:
        # return
        return await self.repo.list_ids_by_type(
            center_id=center_id,
            program_type=program_type,
        )
