from datetime import date, datetime, time

from sqlalchemy import and_, or_, update

from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import Notification


class NotificationRepository(PostgresRepository[Notification]):
    model = Notification

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 50,
        recipient_id: str | None = None,
        category: str | None = None,
        event_type: str | None = None,
        priority: str | None = None,
        keyword: str | None = None,
        unread_only: bool | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[Notification], int]:
        where = [Notification.center_id == center_id]
        if ids is not None:
            where.append(Notification.id.in_(ids))
        if recipient_id:
            where.append(Notification.recipient_id == recipient_id)
        if category:
            where.append(Notification.category == category)
        if event_type:
            where.append(Notification.event_type == event_type)
        if priority:
            where.append(Notification.priority == priority)
        if keyword:
            where.append(or_(
                Notification.title.ilike(f"%{keyword}%"),
                Notification.body.ilike(f"%{keyword}%"),
            ))
        if unread_only:
            where.append(Notification.is_read.is_(False))
        if date_from:
            where.append(Notification.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(Notification.created_at <= datetime.combine(date_to, time.max))
        col, descending = resolve_sort(sort, time_col="created_at")
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        recipient_id: uuid_str,
        category: str,
        event_type: str,
        title: str,
        body: str,
        priority: str = "normal",
        data: dict | None = None,
        event_ref: str | None = None,
    ) -> Notification:
        return await super().add(
            Notification(
                center_id=center_id,
                recipient_id=recipient_id,
                category=category,
                event_type=event_type,
                title=title,
                body=body,
                priority=priority,
                data=data,
                event_ref=event_ref,
            )
        )

    @typecheck
    async def update_all_read_in_center(
        self,
        center_id: uuid_str,
        recipient_id: uuid_str,
    ) -> list[Notification]:
        # RETURNING으로 영향 행을 돌려준다 — bulk read의 per-row atomic 생성을 위해(eventing §4)
        stmt = (
            update(Notification)
            .where(
                and_(
                    Notification.center_id == center_id,
                    Notification.recipient_id == recipient_id,
                    Notification.is_read == False,  # noqa: E712
                    Notification.deleted_at.is_(None),
                )
            )
            .values(is_read=True, read_at=utc_now())
            .returning(Notification)
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return list(result.scalars().all())

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        is_read: bool = unset,
        read_at: utc_dt | None = unset,
    ) -> Notification | None:
        return await self.update_fields(id, is_read=is_read, read_at=read_at)

    async def update_all_read_by_recipient(
        self,
        recipient_id: uuid_str,
    ) -> list[Notification]:
        # 앱 알림함은 센터 구분 없는 단일 인박스 — 전 센터를 한 번에 읽음 처리
        stmt = (
            update(Notification)
            .where(
                and_(
                    Notification.recipient_id == recipient_id,
                    Notification.is_read == False,  # noqa: E712
                    Notification.deleted_at.is_(None),
                )
            )
            .values(is_read=True, read_at=utc_now())
            .returning(Notification)
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return list(result.scalars().all())

    # #
    # query

    @typecheck
    async def find_by_event_ref(
        self,
        event_ref: str,
        recipient_id: uuid_str | None = None,
    ) -> Notification | None:
        where = [Notification.event_ref == event_ref]
        if recipient_id is not None:
            where.append(Notification.recipient_id == recipient_id)
        return await self._find(where=where)

    @typecheck
    async def list_in_center_with_page(
        self,
        center_id: uuid_str,
        recipient_id: uuid_str,
        category: str | None = None,
        is_read: bool | None = None,
        search: str | None = None,
        *,
        page: int = 1,
        size: int = 20,
        sort: str = "desc",
    ) -> tuple[list[Notification], Page]:
        where = [
            Notification.center_id == center_id,
            Notification.recipient_id == recipient_id,
        ]
        if category:
            where.append(Notification.category == category)
        if is_read is not None:
            where.append(Notification.is_read == is_read)
        if search:
            where.append(
                or_(
                    Notification.title.ilike(f"%{search}%"),
                    Notification.body.ilike(f"%{search}%"),
                )
            )
        return await self._page(
            where=where,
            order_by="created_at",
            descending=(sort != "asc"),
            page=page,
            size=size,
        )

    @typecheck
    async def list_by_filters(
        self,
        center_id: uuid_str,
        recipient_id: uuid_str | None = None,
        category: str | None = None,
        event_type: str | None = None,
        priority: str | None = None,
        title: str | None = None,
        unread_only: bool | None = None,
        *,
        limit: int = 50,
    ) -> list[Notification]:
        where = [Notification.center_id == center_id]
        if recipient_id:
            where.append(Notification.recipient_id == recipient_id)
        if category:
            where.append(Notification.category == category)
        if event_type:
            where.append(Notification.event_type == event_type)
        if priority:
            where.append(Notification.priority == priority)
        if title:
            where.append(Notification.title.ilike(f"%{title}%"))
        if unread_only is True:
            where.append(Notification.is_read == False)  # noqa: E712
        return await self._filter(
            where=where,
            order_by="created_at",
            descending=True,
            limit=limit,
        )

    @typecheck
    async def count_unread_in_center(
        self,
        center_id: uuid_str,
        recipient_id: uuid_str,
    ) -> int:
        return await self._count(
            where=[
                Notification.center_id == center_id,
                Notification.recipient_id == recipient_id,
                Notification.is_read == False,  # noqa: E712
            ]
        )

    @typecheck
    async def find_for_recipient(
        self,
        notification_id: uuid_str,
        recipient_id: uuid_str,
    ) -> Notification | None:
        return await self._find(
            where=[
                Notification.id == notification_id,
                Notification.recipient_id == recipient_id,
            ]
        )

    @typecheck
    async def list_by_recipient_with_page(
        self,
        recipient_id: uuid_str,
        category: str | None = None,
        is_read: bool | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Notification], Page]:
        where = [Notification.recipient_id == recipient_id]
        if category:
            where.append(Notification.category == category)
        if is_read is not None:
            where.append(Notification.is_read == is_read)
        return await self._page(
            where=where,
            order_by="created_at",
            descending=True,
            page=page,
            size=size,
        )

    @typecheck
    async def count_unread_by_recipient(
        self,
        recipient_id: uuid_str,
    ) -> int:
        return await self._count(
            where=[
                Notification.recipient_id == recipient_id,
                Notification.is_read == False,  # noqa: E712
            ]
        )
