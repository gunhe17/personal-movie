from sqlalchemy import func, select
from sqlalchemy import update as sql_update

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import Center


class CenterRepository(PostgresRepository[Center]):
    model = Center

    # #
    # command

    @typecheck
    async def add(
        self,
        name: str,
        code: str,
        is_active: bool = True,
        phone: str | None = None,
        address: dict | None = None,
        description: str | None = None,
        logo_url: str | None = None,
        image_urls: list[str] | None = None,
        business_registration_number: str | None = None,
        representative_name: str | None = None,
    ) -> Center:
        return await super().add(
            Center(
                name=name,
                code=code,
                is_active=is_active,
                phone=phone,
                address=address,
                description=description,
                logo_url=logo_url,
                image_urls=image_urls,
                business_registration_number=business_registration_number,
                representative_name=representative_name,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        name: str = unset,
        code: str = unset,
        is_active: bool = unset,
        phone: str | None = unset,
        address: dict | None = unset,
        description: str | None = unset,
        logo_url: str | None = unset,
        image_urls: list[str] | None = unset,
        business_registration_number: str | None = unset,
        representative_name: str | None = unset,
    ) -> Center | None:
        return await self.update_fields(
            id,
            name=name,
            code=code,
            is_active=is_active,
            phone=phone,
            address=address,
            description=description,
            logo_url=logo_url,
            image_urls=image_urls,
            business_registration_number=business_registration_number,
            representative_name=representative_name,
        )

    @typecheck
    async def restore_by_id(self, id: uuid_str) -> Center | None:
        stmt = (
            sql_update(Center)
            .where(Center.id == id, Center.deleted_at.isnot(None))
            .values(deleted_at=None, is_active=True, updated_at=func.now())
            .returning(Center)
        )
        center = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return center

    # #
    # query

    @typecheck
    async def find_by_id_including_deleted(self, id: uuid_str) -> Center | None:
        stmt = select(Center).where(Center.id == id)
        rows = await self._scalars(stmt)
        return rows[0] if rows else None

    @typecheck
    async def find_by_code(self, code: str) -> Center | None:
        return await self._find(where=[Center.code == code])

    @typecheck
    async def exists_by_code(self, code: str) -> bool:
        center = await self.find_by_code(code=code)
        return center is not None

    @typecheck
    async def get_active(self, id: uuid_str) -> Center:
        center = await self.find_by_id(id)
        if center is None:
            raise EntityNotFoundException(f"센터를 찾을 수 없습니다: {id}")
        return center

    @typecheck
    async def list_active(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Center]:
        return await self._filter(
            order_by="created_at",
            descending=True,
            limit=limit,
            offset=skip,
        )

    @typecheck
    async def count_active(self) -> int:
        return await self._count()

    @typecheck
    async def list_by_ids(
        self,
        center_ids: list[str],
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Center]:
        if not center_ids:
            return []

        return await self._filter(
            where=[Center.id.in_(center_ids)],
            order_by="created_at",
            descending=True,
            limit=limit,
            offset=skip,
        )

    @typecheck
    async def count_by_ids(self, center_ids: list[str]) -> int:
        if not center_ids:
            return 0

        return await self._count(where=[Center.id.in_(center_ids)])
