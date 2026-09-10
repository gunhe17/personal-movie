from datetime import datetime

from sqlalchemy import or_, select, tuple_

from app.core.type import typecheck, unset, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CareBoardEntry


class CareBoardEntryRepository(PostgresRepository[CareBoardEntry]):
    model = CareBoardEntry

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        kind: str,
        occurred_at: datetime,
        source_table: str,
        source_id: uuid_str,
        share_class: str,
        case_id: uuid_str | None = None,
        actor_id: uuid_str | None = None,
        person_id: uuid_str | None = None,
        title: str | None = None,
        subtitle: str | None = None,
        body: str | None = None,
        meta: str | None = None,
    ) -> CareBoardEntry:
        return await super().add(
            CareBoardEntry(
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
        )

    @typecheck
    async def update_by_id(
        self,
        entry_id: uuid_str,
        *,
        occurred_at: datetime = unset,
        case_id: uuid_str | None = unset,
        actor_id: uuid_str | None = unset,
        person_id: uuid_str | None = unset,
        share_class: str = unset,
        title: str | None = unset,
        subtitle: str | None = unset,
        body: str | None = unset,
        meta: str | None = unset,
        pinned: bool = unset,
        pinned_at: datetime | None = unset,
        pinned_by: uuid_str | None = unset,
        source_deleted_at: datetime | None = unset,
    ) -> CareBoardEntry | None:
        return await self.update_fields(
            entry_id,
            occurred_at=occurred_at,
            case_id=case_id,
            actor_id=actor_id,
            person_id=person_id,
            share_class=share_class,
            title=title,
            subtitle=subtitle,
            body=body,
            meta=meta,
            pinned=pinned,
            pinned_at=pinned_at,
            pinned_by=pinned_by,
            source_deleted_at=source_deleted_at,
        )

    # #
    # query

    async def find_by_source(
        self, *, source_table: str, source_id: str, client_id: str
    ) -> CareBoardEntry | None:
        return await self._find(
            where=[
                CareBoardEntry.source_table == source_table,
                CareBoardEntry.source_id == source_id,
                CareBoardEntry.client_id == client_id,
            ]
        )

    async def list_by_source(
        self, *, source_table: str, source_id: str
    ) -> list[CareBoardEntry]:
        return await self._filter(
            where=[
                CareBoardEntry.source_table == source_table,
                CareBoardEntry.source_id == source_id,
            ]
        )

    async def get_in_center(self, *, entry_id: str, center_id: str) -> CareBoardEntry | None:
        return await self._find(
            where=[CareBoardEntry.id == entry_id, CareBoardEntry.center_id == center_id]
        )

    async def list_for_client(
        self,
        *,
        center_id: str,
        client_id: str,
        kinds: list[str] | None = None,
        before_at: datetime | None = None,
        before_id: str | None = None,
        limit: int = 50,
    ) -> list[CareBoardEntry]:
        where = [
            CareBoardEntry.deleted_at.is_(None),
            CareBoardEntry.center_id == center_id,
            CareBoardEntry.client_id == client_id,
        ]
        if kinds:
            where.append(CareBoardEntry.kind.in_(kinds))
        if before_at is not None and before_id is not None:
            # 같은 시각 행이 여럿이면(백필·일괄 등록) 시각만으로 자르는 커서는
            # 그 시각 행들을 통째로 건너뛴다 — 정렬 키와 같은 (시각, id)로 비교한다
            where.append(
                tuple_(CareBoardEntry.occurred_at, CareBoardEntry.id)
                < tuple_(before_at, before_id)
            )
        elif before_at is not None:
            where.append(CareBoardEntry.occurred_at < before_at)
        stmt = (
            select(CareBoardEntry)
            .where(*where)
            .order_by(CareBoardEntry.occurred_at.desc(), CareBoardEntry.id.desc())
            .limit(limit)
        )
        return await self._scalars(stmt)

    async def list_all_for_client(
        self, *, center_id: str, client_id: str
    ) -> list[CareBoardEntry]:
        """정리(prune) 대상 판정용 — 절삭 없이 이 내담자의 살아 있는 행 전부."""
        return await self._filter(
            where=[
                CareBoardEntry.center_id == center_id,
                CareBoardEntry.client_id == client_id,
            ]
        )

    async def list_pinned_for_client(
        self, *, center_id: str, client_id: str
    ) -> list[CareBoardEntry]:
        return await self._filter(
            where=[
                CareBoardEntry.center_id == center_id,
                CareBoardEntry.client_id == client_id,
                CareBoardEntry.pinned.is_(True),
            ],
            order_by="pinned_at",
            descending=True,
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
        where = [
            CareBoardEntry.center_id == center_id,
            CareBoardEntry.client_id == client_id,
        ]
        if since is not None:
            # occurred_at(사건 시각)이 아니라 created_at(행이 생긴 시각) —
            # 지난주 회기를 오늘 완료 처리해도 "지난주 것"이 되어 안 잡히던 문제.
            # updated_at은 쓸 수 없다: 재구축이 매 이벤트마다 전 행을 갱신한다.
            where.append(CareBoardEntry.created_at > since)
        if kinds:
            where.append(CareBoardEntry.kind.in_(kinds))
        if exclude_actor_id:
            where.append(
                or_(
                    CareBoardEntry.actor_id.is_(None),
                    CareBoardEntry.actor_id != exclude_actor_id,
                )
            )
        return await self._count(where=where)
