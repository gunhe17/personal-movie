from app.core.datetime_utils import utc_now

from ..models import CareBoardRead
from ..repository import CareBoardReadRepository


class MarkReadService:
    def __init__(self, repo: CareBoardReadRepository):
        self.repo = repo

    async def execute(
        self, *, center_id: str, client_id: str, member_id: str
    ) -> CareBoardRead:
        return await self.repo.upsert(
            center_id=center_id,
            client_id=client_id,
            member_id=member_id,
            last_seen_at=utc_now(),
        )
