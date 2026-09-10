from app.core.type import uuid_str

from ..models import LedgerEntry
from ..repository import LedgerEntryRepository


class DeleteEntryService:
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
        # 즉시 파기 + 무내용 tombstone — 행은 멱등 앵커로만 남는다(설계.md §15-5)
        return await self.repo.purge_visible(
            id=entry_id,
            person_id=person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
        )
