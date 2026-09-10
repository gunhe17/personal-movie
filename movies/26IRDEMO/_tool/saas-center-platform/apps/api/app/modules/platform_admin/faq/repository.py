from sqlalchemy import func, or_, select

from app.core.type import unset, uuid_str, utc_dt
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository
from .models import FAQ, FAQCategory


class FAQRepository(PostgresRepository[FAQ]):
    model = FAQ

    # #
    # command

    @typecheck
    async def add(
        self,
        category: FAQCategory,
        question: str,
        answer: str,
        is_published: bool,
        sort_order: int,
        created_by: uuid_str,
    ) -> FAQ:
        return await super().add(
            FAQ(
                category=category,
                question=question,
                answer=answer,
                is_published=is_published,
                sort_order=sort_order,
                created_by=created_by,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        category: FAQCategory = unset,
        question: str = unset,
        answer: str = unset,
        is_published: bool = unset,
        sort_order: int = unset,
    ) -> FAQ:
        await self.get_by_id(id)
        updated = await self.update_fields(
            id,
            category=category,
            question=question,
            answer=answer,
            is_published=is_published,
            sort_order=sort_order,
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def next_sort_order(self, category: str) -> int:
        current = (
            await self._session.execute(
                select(func.coalesce(func.max(FAQ.sort_order), -1)).where(
                    FAQ.category == category, FAQ.deleted_at.is_(None)
                )
            )
        ).scalar_one()
        return current + 1

    @typecheck
    async def list_ids_by_category(self, category: str) -> list[str]:
        rows = await self._filter(where=[FAQ.category == category])
        return [row.id for row in rows]

    @typecheck
    async def list_published_with_page(
        self,
        *,
        category: str | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 100,
    ) -> tuple[list[FAQ], Page]:
        where = [FAQ.deleted_at.is_(None), FAQ.is_published.is_(True)]
        if category:
            where.append(FAQ.category == category)
        if search:
            where.append(
                or_(FAQ.question.ilike(f"%{search}%"), FAQ.answer.ilike(f"%{search}%"))
            )

        total = await self._count(where=where)
        # 복합 정렬(category, sort_order)은 base sugar 밖 — 직접 stmt + _scalars
        rows = await self._scalars(
            select(FAQ)
            .where(*where)
            .order_by(FAQ.category.asc(), FAQ.sort_order.asc())
            .offset((page - 1) * size)
            .limit(size)
        )
        page_meta: Page = {
            "total": total,
            "page": page,
            "size": size,
            "pages": (total + size - 1) // size if size > 0 else 0,
        }
        return list(rows), page_meta
