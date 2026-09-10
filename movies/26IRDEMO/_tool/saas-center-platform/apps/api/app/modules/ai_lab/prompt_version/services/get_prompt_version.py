from app.core.exceptions import EntityNotFoundException

from ..models import LabPromptVersion
from ..repository import LabPromptVersionRepository


class GetPromptVersionService:
    def __init__(self, repo: LabPromptVersionRepository):
        self.repo = repo

    async def execute(self, prompt_version_id: str) -> LabPromptVersion:
        # load
        pv = await self.repo.find_by_id(id=prompt_version_id)
        if not pv:
            raise EntityNotFoundException(f"Prompt version not found: {prompt_version_id}")
        return pv
