from ..repository import LabPromptVersionRepository


class DeletePromptVersionService:
    def __init__(
        self,
        repo: LabPromptVersionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        version_id: str,
    ) -> None:
        # remove
        await self.repo.remove_by_id(id=version_id)
