from datetime import timedelta

from sqlalchemy import and_, func, not_, select

from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException
from app.core.type import typecheck, unset, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from ..ledger_entry.models import LedgerEntry
from .models import LedgerMedia, LedgerMediaType, LedgerMediaUploadStatus

# 예약만 하고 안 올린 건 이 시간이 지나면 쿼터에서 놓아준다 —
# 행은 재시도 포인터로 남긴다(설계.md §15-2 "pending 24h GC")
STALE_PENDING_HOURS = 24


class LedgerMediaRepository(PostgresRepository[LedgerMedia]):
    model = LedgerMedia

    # #
    # command

    @typecheck
    async def add(
        self,
        entry_id: uuid_str,
        storage_path: str,
        quota_month: str,
        *,
        media_type: LedgerMediaType,
        duration_ms: int | None = None,
        sort_order: int = 0,
    ) -> LedgerMedia:
        return await super().add(
            LedgerMedia(
                entry_id=entry_id,
                storage_path=storage_path,
                quota_month=quota_month,
                media_type=media_type.value,
                upload_status=LedgerMediaUploadStatus.PENDING.value,
                duration_ms=duration_ms,
                sort_order=sort_order,
            )
        )

    @typecheck
    async def update_in_entry(
        self,
        id: uuid_str,
        entry_id: uuid_str,
        *,
        upload_status: LedgerMediaUploadStatus = unset,
        checksum: str | None = unset,
        width: int | None = unset,
        height: int | None = unset,
        poster_path: str | None = unset,
    ) -> LedgerMedia:
        await self.get_in_entry(id=id, entry_id=entry_id)
        updated = await self.update_fields(
            id,
            upload_status=(
                upload_status.value
                if isinstance(upload_status, LedgerMediaUploadStatus)
                else upload_status
            ),
            checksum=checksum,
            width=width,
            height=height,
            poster_path=poster_path,
        )
        assert updated is not None
        return updated

    @typecheck
    async def remove_in_entry(
        self,
        id: uuid_str,
        entry_id: uuid_str,
    ) -> LedgerMedia:
        await self.get_in_entry(id=id, entry_id=entry_id)
        removed = await self.remove_by_id(id)
        assert removed is not None
        return removed

    @typecheck
    async def remove_by_entry_ids(
        self,
        entry_ids: list[str],
    ) -> int:
        return await self.remove_where(where=[LedgerMedia.entry_id.in_(entry_ids)])

    # #
    # query

    @typecheck
    async def get_in_entry(
        self,
        id: uuid_str,
        entry_id: uuid_str,
    ) -> LedgerMedia:
        media = await self._find(
            where=[LedgerMedia.id == id, LedgerMedia.entry_id == entry_id]
        )
        if media is None:
            raise EntityNotFoundException(f"첨부를 찾을 수 없습니다: {id}")
        return media

    @typecheck
    async def list_by_entry_ids(
        self,
        entry_ids: list[str],
    ) -> list[LedgerMedia]:
        if not entry_ids:
            return []
        return await self._filter(
            where=[LedgerMedia.entry_id.in_(entry_ids)],
            order_by="sort_order",
        )

    @typecheck
    async def count_by_author_in_quota_month(
        self,
        author_person_id: uuid_str,
        quota_month: str,
        *,
        media_type: LedgerMediaType,
    ) -> int:
        """작성자 기준 월 사용량 — 엔트리를 경유해 세면 occurred_at 수정으로 새어 나간다."""
        stale_before = utc_now() - timedelta(hours=STALE_PENDING_HOURS)
        stmt = (
            select(func.count())
            .select_from(LedgerMedia)
            .join(LedgerEntry, LedgerEntry.id == LedgerMedia.entry_id)
            .where(
                LedgerMedia.deleted_at.is_(None),
                LedgerEntry.deleted_at.is_(None),
                LedgerMedia.quota_month == quota_month,
                LedgerMedia.media_type == media_type.value,
                LedgerEntry.author_person_id == author_person_id,
                not_(
                    and_(
                        LedgerMedia.upload_status
                        == LedgerMediaUploadStatus.PENDING.value,
                        LedgerMedia.created_at < stale_before,
                    )
                ),
            )
        )
        return await self._session.scalar(stmt) or 0

    @typecheck
    async def next_sort_order(
        self,
        entry_id: uuid_str,
    ) -> int:
        return await self._next_seq(
            LedgerMedia.sort_order, where=[LedgerMedia.entry_id == entry_id]
        )
