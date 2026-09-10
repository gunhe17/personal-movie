from datetime import datetime

from app.core.type import typecheck, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CareBoardRead


class CareBoardReadRepository(PostgresRepository[CareBoardRead]):
    model = CareBoardRead

    # #
    # command

    @typecheck
    async def upsert(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        member_id: uuid_str,
        last_seen_at: datetime,
    ) -> CareBoardRead:
        current = await self.find_for_member(
            center_id=center_id, client_id=client_id, member_id=member_id
        )
        if current is None:
            return await super().add(
                CareBoardRead(
                    center_id=center_id,
                    client_id=client_id,
                    member_id=member_id,
                    last_seen_at=last_seen_at,
                )
            )
        updated = await self.update_fields(current.id, last_seen_at=last_seen_at)
        assert updated is not None
        return updated

    # #
    # query

    async def find_for_member(
        self, *, center_id: str, client_id: str, member_id: str
    ) -> CareBoardRead | None:
        return await self._find(
            where=[
                CareBoardRead.center_id == center_id,
                CareBoardRead.client_id == client_id,
                CareBoardRead.member_id == member_id,
            ]
        )
