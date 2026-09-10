from app.core.type import unset, utc_dt, uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..ledger_entry.models import LedgerEntry, LedgerEntryType, LedgerMood
from ..ledger_entry.repository import LedgerEntryRepository
from ..ledger_entry.services import (
    CountEntriesByDateService,
    CreateEntryService,
    DeleteEntryService,
    GetEntryService,
    ListEntriesService,
    MoveEntriesProfileService,
    MoveEntryProfileService,
    SetEntryBookmarkService,
    UpdateEntryService,
)
from ..ledger_media.models import LedgerMedia, LedgerMediaType
from ..ledger_media.repository import LedgerMediaRepository
from ..ledger_media.services import (
    CompleteMediaService,
    DeleteMediaService,
    GetMediaService,
    ListMediaService,
    ReserveMediaService,
)


class LedgerFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def create_entry(
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
        return await CreateEntryService(self._uow.repo(LedgerEntryRepository)).execute(
            profile_id=profile_id,
            author_person_id=author_person_id,
            client_key=client_key,
            occurred_at=occurred_at,
            entry_type=entry_type,
            mood=mood,
            body=body,
            private_memo=private_memo,
        )

    async def get_entry(
        self,
        *,
        entry_id: uuid_str,
        person_id: uuid_str,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
    ) -> LedgerEntry:
        return await GetEntryService(self._uow.repo(LedgerEntryRepository)).execute(
            entry_id,
            person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
        )

    async def list_entries(
        self,
        *,
        person_id: uuid_str,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
        cursor: utc_dt | None = None,
        limit: int = 20,
        bookmarked_only: bool = False,
        occurred_from: utc_dt | None = None,
        occurred_to: utc_dt | None = None,
    ) -> list[LedgerEntry]:
        return await ListEntriesService(self._uow.repo(LedgerEntryRepository)).execute(
            person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
            cursor=cursor,
            limit=limit,
            bookmarked_only=bookmarked_only,
            occurred_from=occurred_from,
            occurred_to=occurred_to,
        )

    async def update_entry(
        self,
        *,
        entry_id: uuid_str,
        person_id: uuid_str,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
        occurred_at: utc_dt = unset,
        mood: LedgerMood | None = unset,
        body: str | None = unset,
        private_memo: str | None = unset,
    ) -> LedgerEntry:
        return await UpdateEntryService(self._uow.repo(LedgerEntryRepository)).execute(
            entry_id,
            person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
            occurred_at=occurred_at,
            mood=mood,
            body=body,
            private_memo=private_memo,
        )

    async def delete_entry(
        self,
        *,
        entry_id: uuid_str,
        person_id: uuid_str,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
    ) -> LedgerEntry:
        return await DeleteEntryService(self._uow.repo(LedgerEntryRepository)).execute(
            entry_id,
            person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
        )

    async def move_entry_profile(
        self,
        *,
        entry_id: uuid_str,
        person_id: uuid_str,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
        target_profile_id: uuid_str,
    ) -> LedgerEntry:
        return await MoveEntryProfileService(self._uow.repo(LedgerEntryRepository)).execute(
            entry_id,
            person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
            target_profile_id=target_profile_id,
        )

    async def move_entries_profile(
        self,
        *,
        source_profile_id: uuid_str,
        target_profile_id: uuid_str,
    ) -> int:
        return await MoveEntriesProfileService(self._uow.repo(LedgerEntryRepository)).execute(
            source_profile_id=source_profile_id,
            target_profile_id=target_profile_id,
        )

    async def set_entry_bookmark(
        self,
        *,
        entry_id: uuid_str,
        person_id: uuid_str,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
        bookmarked: bool,
    ) -> LedgerEntry:
        return await SetEntryBookmarkService(self._uow.repo(LedgerEntryRepository)).execute(
            entry_id,
            person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
            bookmarked=bookmarked,
        )

    async def count_entries_by_date(
        self,
        *,
        person_id: uuid_str,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
        occurred_from: utc_dt,
        occurred_to: utc_dt,
    ) -> dict[str, int]:
        return await CountEntriesByDateService(self._uow.repo(LedgerEntryRepository)).execute(
            person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
            occurred_from=occurred_from,
            occurred_to=occurred_to,
        )

    async def reserve_media(
        self,
        *,
        entry_id: uuid_str,
        media_type: LedgerMediaType,
        quota_month: str,
        storage_path: str,
        duration_ms: int | None = None,
        author_person_id: uuid_str,
    ) -> LedgerMedia:
        return await ReserveMediaService(self._uow.repo(LedgerMediaRepository)).execute(
            entry_id,
            media_type=media_type,
            quota_month=quota_month,
            storage_path=storage_path,
            duration_ms=duration_ms,
            author_person_id=author_person_id,
        )

    async def complete_media(
        self,
        *,
        media_id: uuid_str,
        entry_id: uuid_str,
        checksum: str | None = None,
        width: int | None = None,
        height: int | None = None,
    ) -> LedgerMedia:
        return await CompleteMediaService(self._uow.repo(LedgerMediaRepository)).execute(
            media_id,
            entry_id,
            checksum=checksum,
            width=width,
            height=height,
        )

    async def delete_media(
        self,
        *,
        media_id: uuid_str,
        entry_id: uuid_str,
    ) -> LedgerMedia:
        return await DeleteMediaService(self._uow.repo(LedgerMediaRepository)).execute(
            media_id,
            entry_id,
        )

    async def list_media(
        self,
        *,
        entry_ids: list[str],
    ) -> list[LedgerMedia]:
        return await ListMediaService(self._uow.repo(LedgerMediaRepository)).execute(
            entry_ids=entry_ids,
        )

    async def get_media(
        self,
        *,
        media_id: uuid_str,
        entry_id: uuid_str,
    ) -> LedgerMedia:
        return await GetMediaService(self._uow.repo(LedgerMediaRepository)).execute(
            media_id,
            entry_id,
        )
