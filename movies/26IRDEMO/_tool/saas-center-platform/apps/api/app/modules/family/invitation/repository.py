from app.core.type import typecheck, unset, utc_dt, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import FamilyInvitation


class FamilyInvitationRepository(PostgresRepository[FamilyInvitation]):
    model = FamilyInvitation

    # #
    # command

    @typecheck
    async def add(
        self,
        family_id: uuid_str,
        code: str,
        invited_by_person_id: uuid_str,
        expires_at: utc_dt,
    ) -> FamilyInvitation:
        return await super().add(
            FamilyInvitation(
                family_id=family_id,
                code=code,
                invited_by_person_id=invited_by_person_id,
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
    ) -> FamilyInvitation | None:
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
    ) -> FamilyInvitation | None:
        return await self._find(
            where=[
                FamilyInvitation.code == code,
                FamilyInvitation.revoked_at.is_(None),
                FamilyInvitation.claimed_at.is_(None),
                FamilyInvitation.expires_at > now,
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
                FamilyInvitation.code == code,
                FamilyInvitation.revoked_at.is_(None),
                FamilyInvitation.claimed_at.is_(None),
                FamilyInvitation.expires_at > now,
            ]
        ) > 0

    @typecheck
    async def list_valid_for_family(
        self,
        family_id: uuid_str,
        *,
        now: utc_dt,
    ) -> list[FamilyInvitation]:
        return await self._filter(
            where=[
                FamilyInvitation.family_id == family_id,
                FamilyInvitation.revoked_at.is_(None),
                FamilyInvitation.claimed_at.is_(None),
                FamilyInvitation.expires_at > now,
            ],
            order_by="created_at",
            descending=True,
        )
