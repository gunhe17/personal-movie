from ..models import LabPromptVersion
from ..repository import LabPromptVersionRepository


class ListPromptVersionsService:
    def __init__(self, repo: LabPromptVersionRepository):
        self.repo = repo

    async def execute(self, prompt_key: str | None = None) -> list[LabPromptVersion]:
        # return (key 지정 = 해당 키 이력, 미지정 = 전체 최근 200)
        if prompt_key:
            return await self.repo.list_by_key(prompt_key=prompt_key)
        return await self.repo.list_all(limit=200)
