from app.core.type import utc_dt
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import Permission


class PermissionRepository(PostgresRepository[Permission]):
    model = Permission

    # #
    # command

    @typecheck
    async def add(
        self,
        code: str,
        name: str,
        category: str,
        added_at: utc_dt,
        description: str | None = None,
        is_new: bool = False,
    ) -> Permission:
        return await super().add(
            Permission(
                code=code,
                name=name,
                category=category,
                added_at=added_at,
                description=description,
                is_new=is_new,
            )
        )

    # #
    # query

    @typecheck
    async def find_by_code(self, code: str) -> Permission | None:
        return await self._find_by(column="code", value=code)

    @typecheck
    async def list_by_category(self, category: str) -> list[Permission]:
        return await self._filter(
            where=[Permission.category == category],
            order_by="code",
        )

    @typecheck
    async def list_new(self) -> list[Permission]:
        return await self._filter(
            where=[Permission.is_new.is_(True)],
            order_by="added_at",
            descending=True,
        )


    @typecheck
    async def list_all(self) -> list[Permission]:
        return await self._filter()
