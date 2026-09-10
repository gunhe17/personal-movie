from datetime import date, datetime, time
from math import ceil

from sqlalchemy import and_, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import Notice
from ..notice_read.models import NoticeRead


class NoticeRepository(PostgresRepository[Notice]):
    model = Notice

    # #
    # command

    @typecheck
    async def add(
        self,
        title: str,
        content: str,
        category: str,
        is_published: bool,
        is_pinned: bool,
        created_by: uuid_str,
        published_at: utc_dt | None = None,
        attachments: list | None = None,
    ) -> Notice:
        return await super().add(
            Notice(
                title=title,
                content=content,
                category=category,
                is_published=is_published,
                is_pinned=is_pinned,
                created_by=created_by,
                published_at=published_at,
                attachments=attachments,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        title: str = unset,
        content: str = unset,
        category: str = unset,
        is_published: bool = unset,
        is_pinned: bool = unset,
        published_at: utc_dt | None = unset,
        attachments: list | None = unset,
    ) -> Notice | None:
        return await self.update_fields(
            id,
            title=title,
            content=content,
            category=category,
            is_published=is_published,
            is_pinned=is_pinned,
            published_at=published_at,
            attachments=attachments,
        )

    @typecheck
    async def upsert_read(
        self,
        *,
        notice_id: uuid_str,
        center_id: uuid_str,
        member_id: uuid_str,
    ) -> None:
        stmt = (
            pg_insert(NoticeRead)
            .values(
                notice_id=notice_id,
                center_id=center_id,
                member_id=member_id,
            )
            .on_conflict_do_nothing(
                constraint="uq_notice_reads_notice_member",
            )
        )
        await self._session.execute(stmt)
        await self._session.flush()

    # #
    # query

    @typecheck
    async def find_published(
        self,
        notice_id: uuid_str,
    ) -> Notice | None:
        return await self._find(
            where=[
                Notice.id == notice_id,
                Notice.is_published.is_(True),
            ]
        )

    @typecheck
    async def list_published_with_page(
        self,
        search: str | None = None,
        category: str | None = None,
        date_from: date | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Notice], Page]:
        where = [Notice.is_published.is_(True)]
        if search:
            where.append(Notice.title.ilike(f"%{search}%"))
        if category:
            where.append(Notice.category == category)
        if date_from:
            where.append(Notice.published_at >= date_from)

        total = await self._count(where=where)
        stmt = (
            select(Notice)
            .where(Notice.deleted_at.is_(None), *where)
            .order_by(Notice.is_pinned.desc(), Notice.published_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        items = await self._scalars(stmt)
        return items, Page(
            total=total,
            page=page,
            size=size,
            pages=ceil(total / size) if size else 0,
        )

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,  # 미사용 — 공지는 플랫폼 전역
        *,
        sort: str | None = None,
        limit: int = 50,
        category: str | None = None,
        keyword: str | None = None,
        is_pinned: bool | None = None,
        published_from: date | None = None,
        published_to: date | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[Notice], int]:
        where = [Notice.is_published.is_(True)]
        if ids is not None:
            where.append(Notice.id.in_(ids))
        if category:
            where.append(Notice.category == category)
        if keyword:
            where.append(Notice.title.ilike(f"%{keyword}%"))
        if is_pinned is not None:
            where.append(Notice.is_pinned.is_(is_pinned))
        if published_from:
            where.append(Notice.published_at >= datetime.combine(published_from, time.min))
        if published_to:
            where.append(Notice.published_at <= datetime.combine(published_to, time.max))
        col, descending = resolve_sort(sort, time_col="published_at", default_col="published_at", event_columns={"published": "published_at"})
        time_order = getattr(Notice, col).desc() if descending else getattr(Notice, col).asc()
        stmt = (
            select(Notice)
            .where(Notice.deleted_at.is_(None), *where)
            .order_by(Notice.is_pinned.desc(), time_order)  # 고정 우선 + 시간축(sort)
            .limit(limit)
        )
        rows = await self._scalars(stmt)
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def list_read_notice_ids(
        self,
        notice_ids: list[str],
        member_id: uuid_str,
    ) -> set[str]:
        if not notice_ids:
            return set()
        stmt = select(NoticeRead.notice_id).where(
            NoticeRead.notice_id.in_(notice_ids),
            NoticeRead.member_id == member_id,
        )
        results = (await self._session.execute(stmt)).scalars().all()
        return set(results)

    @typecheck
    async def find_siblings(
        self,
        notice_id: uuid_str,
        *,
        is_pinned: bool,
        published_at: utc_dt | None,
        created_at: utc_dt,
    ) -> tuple[Notice | None, Notice | None]:
        # 공지 상세의 이전/다음 — 고정(pinned) 우선 정렬 축을 그대로 따른 인접 탐색.
        base_conditions = [
            Notice.deleted_at.is_(None),
            Notice.is_published.is_(True),
        ]
        newer = or_(
            Notice.published_at > published_at,
            and_(
                Notice.published_at == published_at,
                Notice.created_at > created_at,
            ),
        )
        older = or_(
            Notice.published_at < published_at,
            and_(
                Notice.published_at == published_at,
                Notice.created_at < created_at,
            ),
        )

        if is_pinned:
            prev_condition = and_(Notice.is_pinned.is_(True), newer)
            next_condition = or_(
                Notice.is_pinned.is_(False),
                and_(Notice.is_pinned.is_(True), older),
            )
        else:
            prev_condition = or_(
                Notice.is_pinned.is_(True),
                and_(Notice.is_pinned.is_(False), newer),
            )
            next_condition = and_(Notice.is_pinned.is_(False), older)

        prev_stmt = (
            select(Notice)
            .where(*base_conditions, Notice.id != notice_id, prev_condition)
            .order_by(
                Notice.is_pinned.asc(),
                Notice.published_at.asc(),
                Notice.created_at.asc(),
            )
            .limit(1)
        )
        prev_notice = (await self._session.execute(prev_stmt)).scalar_one_or_none()

        next_stmt = (
            select(Notice)
            .where(*base_conditions, Notice.id != notice_id, next_condition)
            .order_by(
                Notice.is_pinned.desc(),
                Notice.published_at.desc(),
                Notice.created_at.desc(),
            )
            .limit(1)
        )
        next_notice = (await self._session.execute(next_stmt)).scalar_one_or_none()

        return prev_notice, next_notice
