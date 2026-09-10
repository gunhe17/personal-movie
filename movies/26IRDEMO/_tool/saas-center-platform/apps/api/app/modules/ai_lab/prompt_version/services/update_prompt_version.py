from ..models import LabPromptVersion
from ..repository import LabPromptVersionRepository


class UpdatePromptVersionService:
    def __init__(
        self,
        repo: LabPromptVersionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        version_id: str,
        data: dict,
    ) -> LabPromptVersion | None:
        # return
        return await self.repo.update_in_place(version_id, **data)
