from datetime import date, datetime, time

from sqlalchemy import or_, select

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository
from app.modules.center.center.models import Center

from .models import CSMemo, MemoType


class CSMemoRepository(PostgresRepository[CSMemo]):
    model = CSMemo

    # #
    # command

    @typecheck
    async def add(
        self,
        title: str,
        content: str,
        memo_type: MemoType,
        created_by: uuid_str,
        center_id: uuid_str | None = None,
        center_name: str | None = None,
    ) -> CSMemo:
        return await super().add(
            CSMemo(
                title=title,
                content=content,
                memo_type=memo_type,
                created_by=created_by,
                center_id=center_id,
                center_name=center_name,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        title: str = unset,
        content: str = unset,
        memo_type: MemoType = unset,
        center_id: uuid_str | None = unset,
        center_name: str | None = unset,
    ) -> CSMemo | None:
        return await self.update_fields(
            id,
            title=title,
            content=content,
            memo_type=memo_type,
            center_id=center_id,
            center_name=center_name,
        )

    # #
    # query

    @typecheck
    async def find_center_name(self, center_id: uuid_str) -> str | None:
        stmt = select(Center.name).where(Center.id == center_id)
        return (await self._session.execute(stmt)).scalar_one_or_none()

    @typecheck
    async def list_memos_with_page(
        self,
        admin_id: uuid_str | None = None,
        search: str | None = None,
        memo_type: str | None = None,
        center_id: uuid_str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        *,
        sort_order: str = "desc",
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[CSMemo], Page]:
        where = []
        if admin_id:
            where.append(CSMemo.created_by == admin_id)
        if memo_type:
            where.append(CSMemo.memo_type == memo_type)
        if center_id:
            where.append(CSMemo.center_id == center_id)
        if search:
            where.append(
                or_(
                    CSMemo.title.ilike(f"%{search}%"),
                    CSMemo.content.ilike(f"%{search}%"),
                )
            )
        if date_from:
            where.append(CSMemo.created_at >= date_from)
        if date_to:
            where.append(CSMemo.created_at <= datetime.combine(date_to, time.max))
        return await self._page(
            where=where,
            order_by="created_at",
            descending=(sort_order != "asc"),
            page=page,
            size=size,
        )

    @typecheck
    async def get_active(self, memo_id: uuid_str) -> CSMemo:
        memo = await self.find_by_id(id=memo_id)
        if memo is None:
            raise EntityNotFoundException(f"메모를 찾을 수 없습니다: {memo_id}")
        return memo

    @typecheck
    async def list_active_many(self, memo_ids: list[str]) -> list[CSMemo]:
        return await self._filter(where=[CSMemo.id.in_(memo_ids)])
