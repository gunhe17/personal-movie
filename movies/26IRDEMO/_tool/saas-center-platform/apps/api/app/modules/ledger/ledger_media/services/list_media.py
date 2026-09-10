from ..models import LedgerMedia
from ..repository import LedgerMediaRepository


class ListMediaService:
    def __init__(
        self,
        repo: LedgerMediaRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        entry_ids: list[str],
    ) -> list[LedgerMedia]:
        # return
        return await self.repo.list_by_entry_ids(entry_ids=entry_ids)
