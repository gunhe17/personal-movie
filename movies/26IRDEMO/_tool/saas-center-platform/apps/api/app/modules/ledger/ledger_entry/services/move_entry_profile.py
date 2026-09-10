from app.core.type import uuid_str

from ..models import LedgerEntry
from ..repository import LedgerEntryRepository


class MoveEntryProfileService:
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
        target_profile_id: uuid_str,
    ) -> LedgerEntry:
        # 날짜(occurred_at)는 쓴 날 그대로 보존한다(설계.md §15-5)
        return await self.repo.update_visible(
            id=entry_id,
            person_id=person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
            profile_id=target_profile_id,
        )
