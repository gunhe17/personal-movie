from app.core.type import utc_dt, uuid_str

from ..models import LedgerEntry
from ..repository import LedgerEntryRepository

MAX_LIMIT = 50


class ListEntriesService:
    def __init__(
        self,
        repo: LedgerEntryRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        person_id: uuid_str,
        *,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
        cursor: utc_dt | None = None,
        limit: int = 20,
        bookmarked_only: bool = False,
        occurred_from: utc_dt | None = None,
        occurred_to: utc_dt | None = None,
    ) -> list[LedgerEntry]:
        # compute
        capped = min(max(limit, 1), MAX_LIMIT)

        # return
        return await self.repo.list_visible(
            person_id=person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
            cursor=cursor,
            limit=capped,
            bookmarked_only=bookmarked_only,
            occurred_from=occurred_from,
            occurred_to=occurred_to,
        )
