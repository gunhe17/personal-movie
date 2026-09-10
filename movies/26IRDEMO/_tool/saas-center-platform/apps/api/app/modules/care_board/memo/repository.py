from datetime import datetime

from app.core.type import typecheck, unset, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CareMemo


class CareMemoRepository(PostgresRepository[CareMemo]):
    model = CareMemo

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        author_id: uuid_str,
        body: str,
    ) -> CareMemo:
        return await super().add(
            CareMemo(
                center_id=center_id,
                client_id=client_id,
                author_id=author_id,
                body=body,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        memo_id: uuid_str,
        center_id: uuid_str,
        *,
        body: str = unset,
        edited_by: uuid_str | None = unset,
        edited_at: datetime | None = unset,
    ) -> CareMemo | None:
        current = await self.get_in_center(memo_id=memo_id, center_id=center_id)
        if current is None:
            return None
        return await self.update_fields(
            memo_id, body=body, edited_by=edited_by, edited_at=edited_at
        )

    # #
    # query

    async def get_in_center(self, *, memo_id: str, center_id: str) -> CareMemo | None:
        return await self._find(
            where=[CareMemo.id == memo_id, CareMemo.center_id == center_id]
        )

    async def list_by_ids(self, *, center_id: str, memo_ids: list[str]) -> list[CareMemo]:
        if not memo_ids:
            return []
        return await self._filter(
            where=[CareMemo.center_id == center_id, CareMemo.id.in_(memo_ids)]
        )

    async def list_for_client(self, *, center_id: str, client_id: str) -> list[CareMemo]:
        return await self._filter(
            where=[CareMemo.center_id == center_id, CareMemo.client_id == client_id],
            order_by="created_at",
        )
