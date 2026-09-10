from app.core.type import uuid_str

from ..models import LedgerEntry
from ..repository import LedgerEntryRepository


class GetEntryService:
    def __init__(
        self,
        repo: LedgerEntryRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        entry_id: uuid_str,
        person_id: uuid_str,
        *,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
    ) -> LedgerEntry:
        # return
        return await self.repo.get_visible(
            id=entry_id,
            person_id=person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
        )
