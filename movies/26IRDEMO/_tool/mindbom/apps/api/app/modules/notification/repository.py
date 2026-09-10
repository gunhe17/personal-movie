"""알림 Repository"""
from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now
from app.core.repository import BaseRepository
from app.modules.notification.models import Notification


class NotificationRepository(BaseRepository[Notification]):
    def __init__(self, session: AsyncSession):
        super().__init__(Notification, session)

    def _scope(self, institution_id: str, recipient_member_id: str):
        return and_(
            Notification.institution_id == institution_id,
            Notification.recipient_member_id == recipient_member_id,
            Notification.deleted_at.is_(None),
        )

    async def list_for_member(
        self,
        institution_id: str,
        recipient_member_id: str,
        *,
        skip: int,
        limit: int,
        unread_only: bool,
    ) -> tuple[list[Notification], int]:
        conditions = [self._scope(institution_id, recipient_member_id)]
        if unread_only:
            conditions.append(Notification.read_at.is_(None))
        where = and_(*conditions)

        list_stmt = (
            select(Notification)
            .where(where)
            .order_by(Notification.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        count_stmt = select(func.count()).select_from(Notification).where(where)

        rows = (await self._session.execute(list_stmt)).scalars().all()
        total = (await self._session.execute(count_stmt)).scalar_one()
        return list(rows), total

    async def count_unread(
        self, institution_id: str, recipient_member_id: str
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(Notification)
            .where(
                self._scope(institution_id, recipient_member_id),
                Notification.read_at.is_(None),
            )
        )
        return (await self._session.execute(stmt)).scalar_one()

    async def mark_one_read(
        self, institution_id: str, recipient_member_id: str, notification_id: str
    ) -> int:
        stmt = (
            update(Notification)
            .where(
                self._scope(institution_id, recipient_member_id),
                Notification.id == notification_id,
                Notification.read_at.is_(None),
            )
            .values(read_at=utc_now())
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount or 0

    async def mark_all_read(
        self, institution_id: str, recipient_member_id: str
    ) -> int:
        stmt = (
            update(Notification)
            .where(
                self._scope(institution_id, recipient_member_id),
                Notification.read_at.is_(None),
            )
            .values(read_at=utc_now())
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount or 0
