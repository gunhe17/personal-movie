from math import ceil

from sqlalchemy import select, func

from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository
from app.modules.notice.notice.models import Notice
from app.modules.notice.notice_read.models import NoticeRead
from app.modules.center.member.models import Member


class NoticeRepository(PostgresRepository[Notice]):
    model = Notice

    # #
    # query

    @typecheck
    async def get_active(self, notice_id: uuid_str) -> Notice:
        notice = await self.find_by_id(id=notice_id)
        if notice is None:
            raise EntityNotFoundException(f"공지사항을 찾을 수 없습니다: {notice_id}")
        return notice

    @typecheck
    async def list_notices_with_page(
        self,
        category: str | None = None,
        is_published: bool | None = None,
        search: str | None = None,
        *,
        sort_order: str = "desc",
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Notice], Page]:
        conditions = [Notice.deleted_at.is_(None)]

        if category:
            conditions.append(Notice.category == category)

        if is_published is not None:
            conditions.append(Notice.is_published.is_(is_published))

        if search:
            conditions.append(Notice.title.ilike(f"%{search}%"))

        count_stmt = (
            select(func.count())
            .select_from(Notice)
            .where(*conditions)
        )
        total = (await self._session.execute(count_stmt)).scalar_one()

        date_order = Notice.created_at.asc() if sort_order == "asc" else Notice.created_at.desc()
        offset = (page - 1) * size
        stmt = (
            select(Notice)
            .where(*conditions)
            .order_by(Notice.is_pinned.desc(), date_order)
            .offset(offset)
            .limit(size)
        )
        rows = await self._scalars(stmt)
        return rows, Page(total=total, page=page, size=size, pages=ceil(total / size) if size else 0)

    @typecheck
    async def aggregate_read_counts(self, notice_ids: list[str]) -> dict[str, int]:
        if not notice_ids:
            return {}

        stmt = (
            select(NoticeRead.notice_id, func.count().label("cnt"))
            .where(NoticeRead.notice_id.in_(notice_ids))
            .group_by(NoticeRead.notice_id)
        )
        results = (await self._session.execute(stmt)).all()
        return {row.notice_id: row.cnt for row in results}

    @typecheck
    async def count_target_members(self) -> int:
        stmt = (
            select(func.count())
            .select_from(Member)
            .where(
                Member.deleted_at.is_(None),
                Member.status == "active",
            )
        )
        return (await self._session.execute(stmt)).scalar_one()

    @typecheck
    async def aggregate_unread_members_all(self, notice_id: uuid_str) -> list[tuple[str, str]]:
        read_subq = (
            select(NoticeRead.member_id)
            .where(NoticeRead.notice_id == notice_id)
            .correlate(Member)
            .scalar_subquery()
        )
        stmt = (
            select(Member.center_id, Member.id)
            .where(
                Member.deleted_at.is_(None),
                Member.status == "active",
                Member.id.not_in(read_subq),
            )
        )
        result = await self._session.execute(stmt)
        return [(row.center_id, row.id) for row in result.all()]

    @typecheck
    async def count_unread_members(
        self,
        notice_id: uuid_str,
        center_id: uuid_str | None = None,
    ) -> int:
        read_subq = select(NoticeRead.member_id).where(
            NoticeRead.notice_id == notice_id,
        )
        if center_id:
            read_subq = read_subq.where(NoticeRead.center_id == center_id)

        conditions = [
            Member.deleted_at.is_(None),
            Member.status == "active",
            Member.id.not_in(read_subq.scalar_subquery()),
        ]
        if center_id:
            conditions.append(Member.center_id == center_id)

        stmt = select(func.count()).select_from(Member).where(*conditions)
        return (await self._session.execute(stmt)).scalar_one()
