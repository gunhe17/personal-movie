from app.core.type import typecheck, unset, utc_dt, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CenterLinkInvitation


class CenterLinkInvitationRepository(PostgresRepository[CenterLinkInvitation]):
    model = CenterLinkInvitation

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        guardian_client_id: uuid_str,
        code: str,
        issued_by_member_id: uuid_str,
        expires_at: utc_dt,
    ) -> CenterLinkInvitation:
        return await super().add(
            CenterLinkInvitation(
                center_id=center_id,
                guardian_client_id=guardian_client_id,
                code=code,
                issued_by_member_id=issued_by_member_id,
                expires_at=expires_at,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        revoked_at: utc_dt | None = unset,
        claimed_at: utc_dt | None = unset,
        claimed_by_person_id: uuid_str | None = unset,
    ) -> CenterLinkInvitation | None:
        return await self.update_fields(
            id,
            revoked_at=revoked_at,
            claimed_at=claimed_at,
            claimed_by_person_id=claimed_by_person_id,
        )

    # #
    # query

    @typecheck
    async def find_valid_by_code(
        self,
        code: str,
        now: utc_dt,
    ) -> CenterLinkInvitation | None:
        return await self._find(
            where=[
                CenterLinkInvitation.code == code,
                CenterLinkInvitation.revoked_at.is_(None),
                CenterLinkInvitation.claimed_at.is_(None),
                CenterLinkInvitation.expires_at > now,
            ]
        )

    @typecheck
    async def exists_valid_code(
        self,
        code: str,
        now: utc_dt,
    ) -> bool:
        return await self._count(
            where=[
                CenterLinkInvitation.code == code,
                CenterLinkInvitation.revoked_at.is_(None),
                CenterLinkInvitation.claimed_at.is_(None),
                CenterLinkInvitation.expires_at > now,
            ]
        ) > 0

    @typecheck
    async def list_valid_for_guardian(
        self,
        center_id: uuid_str,
        guardian_client_id: uuid_str,
        *,
        now: utc_dt,
    ) -> list[CenterLinkInvitation]:
        return await self._filter(
            where=[
                CenterLinkInvitation.center_id == center_id,
                CenterLinkInvitation.guardian_client_id == guardian_client_id,
                CenterLinkInvitation.revoked_at.is_(None),
                CenterLinkInvitation.claimed_at.is_(None),
                CenterLinkInvitation.expires_at > now,
            ],
            order_by="created_at",
            descending=True,
        )
