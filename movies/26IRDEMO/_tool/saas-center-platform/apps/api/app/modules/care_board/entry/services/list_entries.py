from datetime import datetime

from ..models import CareBoardEntry
from ..repository import CareBoardEntryRepository


class ListEntriesService:
    def __init__(self, repo: CareBoardEntryRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        client_id: str,
        kinds: list[str] | None = None,
        before_at: datetime | None = None,
        before_id: str | None = None,
        limit: int = 50,
    ) -> tuple[list[CareBoardEntry], bool]:
        rows = await self.repo.list_for_client(
            center_id=center_id,
            client_id=client_id,
            kinds=kinds,
            before_at=before_at,
            before_id=before_id,
            limit=limit + 1,
        )
        has_more = len(rows) > limit
        return rows[:limit], has_more
