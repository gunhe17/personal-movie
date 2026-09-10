from ..models import GlobalDocument
from ..repository import GlobalDocumentRepository


class ListGlobalDocumentsByIdsService:
    def __init__(self, repo: GlobalDocumentRepository):
        self.repo = repo

    async def execute(
        self,
        ids: list[str],
        *,
        include_deleted: bool = False,
    ) -> list[GlobalDocument]:
        # return
        if include_deleted:
            return await self.repo.list_many_by_ids_including_deleted(ids)
        return await self.repo.list_many_by_ids(ids)
