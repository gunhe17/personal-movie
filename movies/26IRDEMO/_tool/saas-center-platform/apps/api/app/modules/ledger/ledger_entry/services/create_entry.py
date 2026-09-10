from app.core.type import utc_dt, uuid_str

from ..models import LedgerEntry, LedgerEntryType, LedgerMood
from ..repository import LedgerEntryRepository


class CreateEntryService:
    def __init__(
        self,
        repo: LedgerEntryRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        profile_id: uuid_str,
        author_person_id: uuid_str,
        client_key: str,
        occurred_at: utc_dt,
        entry_type: LedgerEntryType = LedgerEntryType.OBSERVATION,
        mood: LedgerMood | None = None,
        body: str | None = None,
        private_memo: str | None = None,
    ) -> LedgerEntry:
        # 재전송 멱등 — 같은 client_key면 기존 행을 그대로 돌려준다(설계.md §15-2)
        existing = await self.repo.find_by_client_key(client_key=client_key)
        if existing is not None:
            return existing

        # return
        return await self.repo.add(
            profile_id=profile_id,
            author_person_id=author_person_id,
            client_key=client_key,
            occurred_at=occurred_at,
            entry_type=entry_type,
            mood=mood,
            body=body,
            private_memo=private_memo,
        )
