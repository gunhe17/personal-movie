from sqlalchemy import delete

from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import ClientVoucherResource


class ClientVoucherResourceRepository(PostgresRepository[ClientVoucherResource]):
    model = ClientVoucherResource

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        client_voucher_id: uuid_str,
        resource_id: uuid_str,
        resource_type: str,
    ) -> ClientVoucherResource:
        return await super().add(
            ClientVoucherResource(
                center_id=center_id,
                client_voucher_id=client_voucher_id,
                resource_id=resource_id,
                resource_type=resource_type,
            )
        )

    @typecheck
    async def hard_delete_by_id(self, id: uuid_str) -> bool:
        stmt = delete(ClientVoucherResource).where(ClientVoucherResource.id == id)
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount > 0

    # #
    # query

    @typecheck
    async def list_by_voucher_and_type(
        self,
        center_id: uuid_str,
        client_voucher_id: uuid_str,
        resource_type: str | None = None,
    ) -> list[ClientVoucherResource]:
        where = [
            ClientVoucherResource.center_id == center_id,
            ClientVoucherResource.client_voucher_id == client_voucher_id,
        ]
        if resource_type:
            where.append(ClientVoucherResource.resource_type == resource_type)
        return await self._filter(
            where=where,
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def find_by_voucher_and_resource(
        self,
        client_voucher_id: uuid_str,
        resource_id: uuid_str,
    ) -> ClientVoucherResource | None:
        return await self._find(
            where=[
                ClientVoucherResource.client_voucher_id == client_voucher_id,
                ClientVoucherResource.resource_id == resource_id,
            ]
        )

    @typecheck
    async def find_by_id_and_center(
        self,
        mapping_id: uuid_str,
        center_id: uuid_str,
    ) -> ClientVoucherResource | None:
        return await self._find(
            where=[
                ClientVoucherResource.id == mapping_id,
                ClientVoucherResource.center_id == center_id,
            ]
        )

    @typecheck
    async def get_by_id_and_center(
        self,
        mapping_id: uuid_str,
        center_id: uuid_str,
    ) -> ClientVoucherResource:
        mapping = await self.find_by_id_and_center(
            mapping_id=mapping_id,
            center_id=center_id,
        )
        if mapping is None:
            raise EntityNotFoundException(
                f"Client voucher resource mapping not found: {mapping_id}"
            )
        return mapping
