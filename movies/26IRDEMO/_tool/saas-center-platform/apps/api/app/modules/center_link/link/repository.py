from app.core.exceptions import EntityNotFoundException
from app.core.type import typecheck, unset, utc_dt, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CenterLink

ALIVE_STATUSES = ("requested", "active", "suspended")


class CenterLinkRepository(PostgresRepository[CenterLink]):
    model = CenterLink

    # #
    # command

    @typecheck
    async def add(
        self,
        family_id: uuid_str,
        profile_id: uuid_str,
        person_id: uuid_str,
        center_id: uuid_str,
        client_id: uuid_str,
        guardian_client_id: uuid_str,
        invitation_id: uuid_str | None = None,
        status: str = "active",
        linked_at: utc_dt | None = None,
    ) -> CenterLink:
        return await super().add(
            CenterLink(
                family_id=family_id,
                profile_id=profile_id,
                person_id=person_id,
                center_id=center_id,
                client_id=client_id,
                guardian_client_id=guardian_client_id,
                invitation_id=invitation_id,
                status=status,
                linked_at=linked_at,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        status: str = unset,
        ended_at: utc_dt | None = unset,
        end_reason: str | None = unset,
    ) -> CenterLink | None:
        return await self.update_fields(
            id,
            status=status,
            ended_at=ended_at,
            end_reason=end_reason,
        )

    # #
    # query

    @typecheck
    async def get_in_family(
        self,
        id: uuid_str,
        family_id: uuid_str,
    ) -> CenterLink:
        link = await self._find(
            where=[CenterLink.id == id, CenterLink.family_id == family_id]
        )
        if link is None:
            raise EntityNotFoundException(f"센터 연결을 찾을 수 없습니다: {id}")
        return link

    @typecheck
    async def find_alive_by_family_client(
        self,
        family_id: uuid_str,
        client_id: uuid_str,
    ) -> CenterLink | None:
        return await self._find(
            where=[
                CenterLink.family_id == family_id,
                CenterLink.client_id == client_id,
                CenterLink.status.in_(ALIVE_STATUSES),
            ]
        )

    @typecheck
    async def list_by_family(
        self,
        family_id: uuid_str,
    ) -> list[CenterLink]:
        return await self._filter(
            where=[CenterLink.family_id == family_id],
            order_by="created_at",
        )

    @typecheck
    async def list_alive_by_family(
        self,
        family_id: uuid_str,
    ) -> list[CenterLink]:
        return await self._filter(
            where=[
                CenterLink.family_id == family_id,
                CenterLink.status.in_(ALIVE_STATUSES),
            ],
            order_by="created_at",
        )

    @typecheck
    @typecheck
    async def list_alive_by_center_client(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
    ) -> list[CenterLink]:
        return await self._filter(
            where=[
                CenterLink.center_id == center_id,
                CenterLink.client_id == client_id,
                CenterLink.status.in_(ALIVE_STATUSES),
            ],
            order_by="created_at",
        )

    @typecheck
    async def list_by_invitation(
        self,
        invitation_id: uuid_str,
    ) -> list[CenterLink]:
        return await self._filter(
            where=[CenterLink.invitation_id == invitation_id],
            order_by="created_at",
        )

    async def list_by_guardian_client(
        self,
        center_id: uuid_str,
        guardian_client_id: uuid_str,
    ) -> list[CenterLink]:
        return await self._filter(
            where=[
                CenterLink.center_id == center_id,
                CenterLink.guardian_client_id == guardian_client_id,
            ],
            order_by="created_at",
        )
