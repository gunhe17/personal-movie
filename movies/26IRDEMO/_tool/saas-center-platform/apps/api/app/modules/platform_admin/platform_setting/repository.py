from sqlalchemy import func
from sqlalchemy import update as sql_update

from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import PlatformSetting


class PlatformSettingRepository(PostgresRepository[PlatformSetting]):
    model = PlatformSetting

    # #
    # command

    @typecheck
    async def update_value(
        self,
        key: str,
        value: str,
    ) -> PlatformSetting | None:
        return await self._update_by_key(key=key, data={"value": value})

    # #
    # query

    @typecheck
    async def list_active(self) -> list[PlatformSetting]:
        return await self._filter()


    # #
    # helpers

    async def _update_by_key(self, *, key: str, data: dict) -> PlatformSetting | None:
        stmt = (
            sql_update(self.model)
            .where(self.model.key == key, self.model.deleted_at.is_(None))
            .values(**data, updated_at=func.now())
            .returning(self.model)
        )
        model = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return model
