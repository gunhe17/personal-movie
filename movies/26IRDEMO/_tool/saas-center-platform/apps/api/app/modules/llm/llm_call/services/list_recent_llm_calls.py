from datetime import datetime

from ..models import LlmCall
from ..repository import LlmCallRepository


class ListRecentLlmCallsService:
    def __init__(
        self,
        repo: LlmCallRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        limit: int = 20,
        date_from: datetime | None = None,
        exclude_purposes: set[str] | frozenset[str] | None = None,
    ) -> list[LlmCall]:
        # return
        return await self.repo.list_recent_by_center(
            center_id=center_id,
            limit=limit,
            date_from=date_from,
            exclude_purposes=exclude_purposes,
        )
