from math import ceil

from .models import ClientLinkRequest, LinkRequestStatus
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository



class ClientLinkRequestRepository(PostgresRepository[ClientLinkRequest]):
    model = ClientLinkRequest

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        person_id: uuid_str,
        phone: str,
        requested_at: utc_dt,
        client_id: uuid_str | None = None,
        status: str = "pending",
        reviewed_at: utc_dt | None = None,
    ) -> ClientLinkRequest:
        return await super().add(
            ClientLinkRequest(
                center_id=center_id,
                person_id=person_id,
                phone=phone,
                requested_at=requested_at,
                client_id=client_id,
                status=status,
                reviewed_at=reviewed_at,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        status: str = unset,
        client_id: uuid_str | None = unset,
        reviewed_at: utc_dt | None = unset,
    ) -> ClientLinkRequest | None:
        return await self.update_fields(
            id,
            status=status,
            client_id=client_id,
            reviewed_at=reviewed_at,
        )

    # #
    # query

    @typecheck
    async def get_in_center(
        self,
        id: uuid_str,
        center_id: uuid_str,
    ) -> ClientLinkRequest:
        request = await self._find(
            where=[
                ClientLinkRequest.id == id,
                ClientLinkRequest.center_id == center_id,
            ]
        )
        if request is None:
            raise EntityNotFoundException(f"연동 요청을 찾을 수 없습니다: {id}")
        return request

    @typecheck
    async def exists_pending_request(
        self,
        person_id: uuid_str,
        center_id: uuid_str,
    ) -> bool:
        return await self._count(
            where=[
                ClientLinkRequest.person_id == person_id,
                ClientLinkRequest.center_id == center_id,
                ClientLinkRequest.status == LinkRequestStatus.PENDING,
            ]
        ) > 0

    @typecheck
    async def list_in_center_with_page(
        self,
        center_id: uuid_str,
        status: str | None = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[ClientLinkRequest], Page]:
        where = [ClientLinkRequest.center_id == center_id]
        if status:
            where.append(ClientLinkRequest.status == status)

        total = await self._count(where=where)
        items = await self._filter(
            where=where,
            order_by="requested_at",
            descending=True,
            limit=limit,
            offset=skip,
        )
        return items, Page(
            total=total,
            page=skip // limit + 1 if limit else 1,
            size=limit,
            pages=ceil(total / limit) if limit else 0,
        )
