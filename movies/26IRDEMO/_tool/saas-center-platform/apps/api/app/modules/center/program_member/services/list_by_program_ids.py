from ..models import ProgramMember
from ..repository import ProgramMemberRepository


class ListByProgramIdsService:
    def __init__(self, repo: ProgramMemberRepository):
        self.repo = repo

    async def execute(
        self,
        program_ids: list[str],
    ) -> dict[str, list[ProgramMember]]:
        if not program_ids:
            return {}

        # load
        members = await self.repo.list_by_program_ids(program_ids=program_ids)

        # group
        result: dict[str, list[ProgramMember]] = {}
        for pm in members:
            result.setdefault(pm.program_id, []).append(pm)

        return result
