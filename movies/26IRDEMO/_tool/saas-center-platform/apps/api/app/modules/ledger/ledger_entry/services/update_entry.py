from app.core.type import unset, utc_dt, uuid_str

from ..models import LedgerEntry, LedgerMood
from ..repository import LedgerEntryRepository


class UpdateEntryService:
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
        occurred_at: utc_dt = unset,
        mood: LedgerMood | None = unset,
        body: str | None = unset,
        private_memo: str | None = unset,
    ) -> LedgerEntry:
        # 수정은 무흔적 — 이력·"수정됨" 표시를 남기지 않는다(설계.md §15-5)
        return await self.repo.update_visible(
            id=entry_id,
            person_id=person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
            occurred_at=occurred_at,
            mood=mood,
            body=body,
            private_memo=private_memo,
        )
