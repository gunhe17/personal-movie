from ..models import LabPromptVersion
from ..repository import LabPromptVersionRepository


class FindPromptVersionService:
    def __init__(self, repo: LabPromptVersionRepository):
        self.repo = repo

    async def execute(self, prompt_id: str) -> LabPromptVersion | None:
        # return
        return await self.repo.find_by_id(id=prompt_id)
