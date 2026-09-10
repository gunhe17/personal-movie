from sqlalchemy import delete

from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from app.modules.client.resource.models import ClientResource


class ClientResourceRepository(PostgresRepository[ClientResource]):
    model = ClientResource

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        resource_id: uuid_str,
        resource_type: str,
    ) -> ClientResource:
        return await super().add(
            ClientResource(
                center_id=center_id,
                client_id=client_id,
                resource_id=resource_id,
                resource_type=resource_type,
            )
        )

    @typecheck
    async def hard_delete_by_id(self, mapping_id: uuid_str) -> bool:
        stmt = delete(ClientResource).where(ClientResource.id == mapping_id)
        result = await self._session.execute(stmt)
        return result.rowcount > 0

    # #
    # query

    @typecheck
    async def list_by_client_and_type(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        resource_type: str | None = None,
        exclude_type: str | None = None,
    ) -> list[ClientResource]:
        where = [
            ClientResource.center_id == center_id,
            ClientResource.client_id == client_id,
        ]
        if resource_type:
            where.append(ClientResource.resource_type == resource_type)
        if exclude_type:
            where.append(ClientResource.resource_type != exclude_type)
        return await self._filter(where=where, order_by="created_at", descending=True)

    @typecheck
    async def find_by_client_and_resource(
        self,
        client_id: uuid_str,
        resource_id: uuid_str,
    ) -> ClientResource | None:
        return await self._find(
            where=[
                ClientResource.client_id == client_id,
                ClientResource.resource_id == resource_id,
            ]
        )

    @typecheck
    async def find_in_center(
        self,
        mapping_id: uuid_str,
        center_id: uuid_str,
    ) -> ClientResource | None:
        return await self._find(
            where=[
                ClientResource.id == mapping_id,
                ClientResource.center_id == center_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        mapping_id: uuid_str,
        center_id: uuid_str,
    ) -> ClientResource:
        mapping = await self.find_in_center(
            mapping_id=mapping_id,
            center_id=center_id,
        )
        if mapping is None:
            raise EntityNotFoundException(
                f"ClientResource not found: {mapping_id}"
            )
        return mapping
