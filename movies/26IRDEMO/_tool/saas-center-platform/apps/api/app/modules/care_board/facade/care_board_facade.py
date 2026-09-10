from datetime import datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..entry.events import CareBoardEntryAtomic
from ..entry.models import CareBoardEntry
from ..entry.repository import CareBoardEntryRepository
from ..entry.services import (
    ListEntriesService,
    MarkSourceDeletedService,
    PruneEntriesService,
    RecordEntryService,
    TogglePinService,
)
from ..memo.events import CareMemoAtomic
from ..memo.models import CareMemo
from ..memo.repository import CareMemoRepository
from ..memo.services import CreateMemoService, DeleteMemoService, UpdateMemoService
from ..read.models import CareBoardRead
from ..read.repository import CareBoardReadRepository
from ..read.services import MarkReadService


class CareBoardFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    # #
    # entry

    async def record_entry(
        self,
        *,
        center_id: str,
        client_id: str,
        kind: str,
        occurred_at: datetime,
        source_table: str,
        source_id: str,
        share_class: str,
        case_id: str | None = None,
        actor_id: str | None = None,
        person_id: str | None = None,
        title: str | None = None,
        subtitle: str | None = None,
        body: str | None = None,
        meta: str | None = None,
    ) -> tuple[CareBoardEntryAtomic, CareBoardEntry]:
        return await RecordEntryService(
            self._uow.repo(CareBoardEntryRepository)
        ).execute(
            center_id=center_id,
            client_id=client_id,
            kind=kind,
            occurred_at=occurred_at,
            source_table=source_table,
            source_id=source_id,
            share_class=share_class,
            case_id=case_id,
            actor_id=actor_id,
            person_id=person_id,
            title=title,
            subtitle=subtitle,
            body=body,
            meta=meta,
        )

    async def mark_source_deleted(
        self, *, source_table: str, source_id: str
    ) -> list[CareBoardEntryAtomic]:
        return await MarkSourceDeletedService(
            self._uow.repo(CareBoardEntryRepository)
        ).execute(source_table=source_table, source_id=source_id)

    async def prune_entries(
        self,
        *,
        center_id: str,
        client_id: str,
        kept: set[tuple[str, str]],
        excluded: set[tuple[str, str]],
    ) -> tuple[int, int]:
        return await PruneEntriesService(
            self._uow.repo(CareBoardEntryRepository)
        ).execute(
            center_id=center_id,
            client_id=client_id,
            kept=kept,
            excluded=excluded,
        )

    async def list_entries(
        self,
        *,
        center_id: str,
        client_id: str,
        kinds: list[str] | None = None,
        before_at: datetime | None = None,
        before_id: str | None = None,
        limit: int = 50,
    ) -> tuple[list[CareBoardEntry], bool]:
        return await ListEntriesService(
            self._uow.repo(CareBoardEntryRepository)
        ).execute(
            center_id=center_id,
            client_id=client_id,
            kinds=kinds,
            before_at=before_at,
            before_id=before_id,
            limit=limit,
        )

    async def list_pinned(
        self, *, center_id: str, client_id: str
    ) -> list[CareBoardEntry]:
        return await self._uow.repo(CareBoardEntryRepository).list_pinned_for_client(
            center_id=center_id, client_id=client_id
        )

    async def count_since(
        self,
        *,
        center_id: str,
        client_id: str,
        since: datetime | None,
        kinds: list[str] | None = None,
        exclude_actor_id: str | None = None,
    ) -> int:
        return await self._uow.repo(CareBoardEntryRepository).count_since(
            center_id=center_id,
            client_id=client_id,
            since=since,
            kinds=kinds,
            exclude_actor_id=exclude_actor_id,
        )

    async def toggle_pin(
        self, *, entry_id: str, center_id: str, member_id: str, pinned: bool
    ) -> tuple[CareBoardEntryAtomic, CareBoardEntry]:
        return await TogglePinService(
            self._uow.repo(CareBoardEntryRepository)
        ).execute(
            entry_id=entry_id,
            center_id=center_id,
            member_id=member_id,
            pinned=pinned,
        )

    # #
    # memo

    async def create_memo(
        self, *, center_id: str, client_id: str, author_id: str, body: str
    ) -> tuple[CareMemoAtomic, CareMemo]:
        return await CreateMemoService(self._uow.repo(CareMemoRepository)).execute(
            center_id=center_id,
            client_id=client_id,
            author_id=author_id,
            body=body,
        )

    async def update_memo(
        self,
        *,
        memo_id: str,
        center_id: str,
        member_id: str,
        body: str,
        is_manager: bool,
    ) -> tuple[CareMemoAtomic, CareMemo]:
        return await UpdateMemoService(self._uow.repo(CareMemoRepository)).execute(
            memo_id=memo_id,
            center_id=center_id,
            member_id=member_id,
            body=body,
            is_manager=is_manager,
        )

    async def delete_memo(
        self, *, memo_id: str, center_id: str, member_id: str, is_manager: bool
    ) -> tuple[CareMemoAtomic, CareMemo]:
        return await DeleteMemoService(self._uow.repo(CareMemoRepository)).execute(
            memo_id=memo_id,
            center_id=center_id,
            member_id=member_id,
            is_manager=is_manager,
        )

    async def get_memos_by_ids(
        self, *, center_id: str, memo_ids: list[str]
    ) -> dict[str, CareMemo]:
        rows = await self._uow.repo(CareMemoRepository).list_by_ids(
            center_id=center_id, memo_ids=memo_ids
        )
        return {row.id: row for row in rows}

    async def list_memos_for_client(
        self, *, center_id: str, client_id: str
    ) -> list[CareMemo]:
        return await self._uow.repo(CareMemoRepository).list_for_client(
            center_id=center_id, client_id=client_id
        )

    # #
    # read

    async def mark_read(
        self, *, center_id: str, client_id: str, member_id: str
    ) -> CareBoardRead:
        return await MarkReadService(self._uow.repo(CareBoardReadRepository)).execute(
            center_id=center_id, client_id=client_id, member_id=member_id
        )

    async def find_read(
        self, *, center_id: str, client_id: str, member_id: str
    ) -> CareBoardRead | None:
        return await self._uow.repo(CareBoardReadRepository).find_for_member(
            center_id=center_id, client_id=client_id, member_id=member_id
        )
