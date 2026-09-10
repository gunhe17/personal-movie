from datetime import datetime

from sqlalchemy import and_, false, func, or_, select
from sqlalchemy import update as sql_update
from sqlalchemy.sql import ColumnElement

from app.core.exceptions import EntityNotFoundException
from app.core.type import typecheck, unset, utc_dt, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import LedgerEntry, LedgerEntryType, LedgerMood


class LedgerEntryRepository(PostgresRepository[LedgerEntry]):
    model = LedgerEntry

    # #
    # helpers

    def _visible(
        self,
        *,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
        person_id: str,
    ) -> ColumnElement[bool]:
        """가시성 술어 — 가족 프로필은 전원, 성인 본인 프로필은 작성자만(설계.md §15-6).

        성인 본인 프로필엔 소유자 링크가 없어 프로필 단위로 못 가른다 — 엔트리의
        author로 가른다.
        """
        clauses = []
        if shared_profile_ids:
            clauses.append(LedgerEntry.profile_id.in_(shared_profile_ids))
        if private_profile_ids:
            clauses.append(
                and_(
                    LedgerEntry.profile_id.in_(private_profile_ids),
                    LedgerEntry.author_person_id == person_id,
                )
            )
        if not clauses:
            return false()
        return or_(*clauses)

    # #
    # command

    @typecheck
    async def add(
        self,
        profile_id: uuid_str,
        author_person_id: uuid_str,
        client_key: str,
        occurred_at: utc_dt,
        *,
        entry_type: LedgerEntryType = LedgerEntryType.OBSERVATION,
        mood: LedgerMood | None = None,
        body: str | None = None,
        private_memo: str | None = None,
        situation_tags: list | None = None,
    ) -> LedgerEntry:
        return await super().add(
            LedgerEntry(
                profile_id=profile_id,
                author_person_id=author_person_id,
                client_key=client_key,
                occurred_at=occurred_at,
                entry_type=entry_type.value,
                mood=mood.value if mood else None,
                body=body,
                private_memo=private_memo,
                situation_tags=situation_tags or [],
            )
        )

    @typecheck
    async def update_visible(
        self,
        id: uuid_str,
        person_id: uuid_str,
        *,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
        occurred_at: utc_dt = unset,
        mood: LedgerMood | None = unset,
        body: str | None = unset,
        private_memo: str | None = unset,
        bookmarked_at: datetime | None = unset,
        profile_id: uuid_str = unset,
    ) -> LedgerEntry:
        await self.get_visible(
            id=id,
            person_id=person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
        )
        updated = await self.update_fields(
            id,
            occurred_at=occurred_at,
            mood=mood.value if isinstance(mood, LedgerMood) else mood,
            body=body,
            private_memo=private_memo,
            bookmarked_at=bookmarked_at,
            profile_id=profile_id,
        )
        assert updated is not None
        return updated

    @typecheck
    async def move_all_in_profile(
        self,
        source_profile_id: uuid_str,
        target_profile_id: uuid_str,
    ) -> int:
        """프로필 병합 — 살아있는 엔트리 전건 이동(tombstone은 멱등 앵커라 두고 간다)."""
        stmt = (
            sql_update(LedgerEntry)
            .where(
                LedgerEntry.deleted_at.is_(None),
                LedgerEntry.profile_id == source_profile_id,
            )
            .values(profile_id=target_profile_id, updated_at=func.now())
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount or 0

    @typecheck
    async def purge_visible(
        self,
        id: uuid_str,
        person_id: uuid_str,
        *,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
    ) -> LedgerEntry:
        """삭제 = 내용 즉시 파기 + 무내용 tombstone(설계.md §15-5).

        행은 멱등 앵커·감사 메타로 남기고 본문·메모·기분만 비운다.
        """
        await self.get_visible(
            id=id,
            person_id=person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
        )
        purged = await self.update_fields(
            id,
            body=None,
            private_memo=None,
            mood=None,
            situation_tags=[],
            bookmarked_at=None,
        )
        assert purged is not None
        removed = await self.remove_by_id(id)
        assert removed is not None
        return removed

    # #
    # query

    @typecheck
    async def get_visible(
        self,
        id: uuid_str,
        person_id: uuid_str,
        *,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
    ) -> LedgerEntry:
        entry = await self._find(
            where=[
                LedgerEntry.id == id,
                self._visible(
                    shared_profile_ids=shared_profile_ids,
                    private_profile_ids=private_profile_ids,
                    person_id=person_id,
                ),
            ]
        )
        if entry is None:
            raise EntityNotFoundException(f"기록을 찾을 수 없습니다: {id}")
        return entry

    @typecheck
    async def find_by_client_key(
        self,
        client_key: str,
    ) -> LedgerEntry | None:
        return await self._find(where=[LedgerEntry.client_key == client_key])

    @typecheck
    async def list_visible(
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
        """occurred_at desc keyset — OFFSET 금지(설계.md §15-4)."""
        where = [
            self._visible(
                shared_profile_ids=shared_profile_ids,
                private_profile_ids=private_profile_ids,
                person_id=person_id,
            )
        ]
        if cursor is not None:
            where.append(LedgerEntry.occurred_at < cursor)
        if bookmarked_only:
            where.append(LedgerEntry.bookmarked_at.is_not(None))
        # 반개구간 [from, to) — 날짜 필터가 경계 기록을 양쪽에서 세지 않게
        if occurred_from is not None:
            where.append(LedgerEntry.occurred_at >= occurred_from)
        if occurred_to is not None:
            where.append(LedgerEntry.occurred_at < occurred_to)
        return await self._filter(
            where=where,
            order_by="occurred_at",
            descending=True,
            limit=limit,
        )

    @typecheck
    async def aggregate_counts_by_date(
        self,
        person_id: uuid_str,
        *,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
        occurred_from: utc_dt,
        occurred_to: utc_dt,
    ) -> list[tuple[str, int]]:
        day = func.to_char(LedgerEntry.occurred_at, "YYYY-MM-DD")
        stmt = (
            select(day, func.count())
            .where(
                LedgerEntry.deleted_at.is_(None),
                self._visible(
                    shared_profile_ids=shared_profile_ids,
                    private_profile_ids=private_profile_ids,
                    person_id=person_id,
                ),
                LedgerEntry.occurred_at >= occurred_from,
                LedgerEntry.occurred_at < occurred_to,
            )
            .group_by(day)
        )
        rows = await self._session.execute(stmt)
        return [(row[0], row[1]) for row in rows.all()]
