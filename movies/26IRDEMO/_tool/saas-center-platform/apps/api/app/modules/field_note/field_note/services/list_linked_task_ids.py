from ..repository import FieldNoteRepository


class ListLinkedTaskIdsService:
    def __init__(self, repo: FieldNoteRepository):
        self.repo = repo

    async def execute(self, center_id: str) -> set[str]:
        # return
        return await self.repo.list_linked_task_ids(center_id=center_id)
