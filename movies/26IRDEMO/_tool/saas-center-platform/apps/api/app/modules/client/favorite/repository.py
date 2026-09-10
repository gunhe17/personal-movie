from sqlalchemy import delete

from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import ClientFavorite


class ClientFavoriteRepository(PostgresRepository[ClientFavorite]):
    model = ClientFavorite

    # #
    # command

    @typecheck
    async def add(
        self,
        person_id: uuid_str,
        client_id: uuid_str,
        center_id: uuid_str,
    ) -> ClientFavorite:
        return await super().add(
            ClientFavorite(
                person_id=person_id,
                client_id=client_id,
                center_id=center_id,
            )
        )

    @typecheck
    async def hard_delete_by_person_client(
        self,
        person_id: uuid_str,
        client_id: uuid_str,
    ) -> int:
        stmt = delete(ClientFavorite).where(
            ClientFavorite.person_id == person_id,
            ClientFavorite.client_id == client_id,
        )
        result = await self._session.execute(stmt)
        return result.rowcount or 0

    # #
    # query

    @typecheck
    async def find_by_person_client(
        self,
        person_id: uuid_str,
        client_id: uuid_str,
    ) -> ClientFavorite | None:
        return await self._find(
            where=[
                ClientFavorite.person_id == person_id,
                ClientFavorite.client_id == client_id,
            ]
        )

    @typecheck
    async def list_by_person_in_center(
        self,
        person_id: uuid_str,
        center_id: uuid_str,
    ) -> list[ClientFavorite]:
        return await self._filter(
            where=[
                ClientFavorite.person_id == person_id,
                ClientFavorite.center_id == center_id,
            ],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_client_ids(
        self,
        person_id: uuid_str,
        center_id: uuid_str,
    ) -> set[str]:
        rows = await self._filter(
            where=[
                ClientFavorite.person_id == person_id,
                ClientFavorite.center_id == center_id,
            ]
        )
        return {row.client_id for row in rows}
