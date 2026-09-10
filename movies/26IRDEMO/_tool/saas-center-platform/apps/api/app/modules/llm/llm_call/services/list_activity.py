from datetime import datetime

from ..models import LlmCall
from ..repository import LlmCallRepository


class ListLlmCallActivityService:
    def __init__(
        self,
        repo: LlmCallRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        member_id: str | None = None,
        source_id: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        limit: int = 20,
    ) -> tuple[list[LlmCall], int]:
        return await self.repo.list_activity_in_center(
            center_id,
            member_id=member_id,
            source_id=source_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )
