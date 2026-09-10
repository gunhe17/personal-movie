from datetime import date, datetime, time

from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException
from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import MemberInvitation


class MemberInvitationRepository(PostgresRepository[MemberInvitation]):
    model = MemberInvitation

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        invited_by: uuid_str,
        name: str,
        email: str,
        role_id: uuid_str,
        expires_at: utc_dt,
        employment_type: str | None = None,
    ) -> MemberInvitation:
        return await super().add(
            MemberInvitation(
                center_id=center_id,
                invited_by=invited_by,
                name=name,
                email=email,
                role_id=role_id,
                expires_at=expires_at,
                employment_type=employment_type,
            )
        )

    @typecheck
    async def update_pending(
        self,
        invitation_id: uuid_str,
        invited_by: uuid_str,
        name: str,
        role_id: uuid_str,
        employment_type: str | None,
        expires_at: utc_dt,
    ) -> MemberInvitation:
        updated = await self.update_fields(
            invitation_id,
            invited_by=invited_by,
            name=name,
            role_id=role_id,
            employment_type=employment_type,
            expires_at=expires_at,
        )
        assert updated is not None
        return updated

    @typecheck
    async def update_completed(
        self,
        invitation_id: uuid_str,
        member_id: uuid_str,
    ) -> MemberInvitation | None:
        invitation = await self.find_by_id(invitation_id)
        if invitation is None or invitation.member_id is not None:
            return invitation
        return await self.update_fields(
            invitation_id,
            member_id=member_id,
            accepted_at=utc_now(),
        )

    # #
    # query

    @typecheck
    async def get_in_center(
        self,
        invitation_id: uuid_str,
        center_id: uuid_str,
    ) -> MemberInvitation:
        invitation = await self._find(
            where=[
                MemberInvitation.id == invitation_id,
                MemberInvitation.center_id == center_id,
            ]
        )
        if invitation is None:
            raise EntityNotFoundException(f"초대를 찾을 수 없습니다: {invitation_id}")
        return invitation

    @typecheck
    async def list_by_center(
        self,
        center_id: uuid_str,
        status: str | None = None,
        search: str | None = None,
        role_id: uuid_str | None = None,
        name: str | None = None,
        email: str | None = None,
        invited_by: uuid_str | None = None,
        expires_after: utc_dt | None = None,
        expires_before: utc_dt | None = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[MemberInvitation]:
        conditions = self._build_invitation_filters(
            center_id=center_id,
            status=status,
            search=search,
            role_id=role_id,
            name=name,
            email=email,
            invited_by=invited_by,
            expires_after=expires_after,
            expires_before=expires_before,
        )

        return await self._filter(
            where=conditions,
            order_by="created_at",
            descending=True,
            limit=limit,
            offset=skip,
        )

    @typecheck
    async def count_by_center(
        self,
        center_id: uuid_str,
        status: str | None = None,
        search: str | None = None,
        role_id: uuid_str | None = None,
        name: str | None = None,
        email: str | None = None,
        invited_by: uuid_str | None = None,
        expires_after: utc_dt | None = None,
        expires_before: utc_dt | None = None,
    ) -> int:
        conditions = self._build_invitation_filters(
            center_id=center_id,
            status=status,
            search=search,
            role_id=role_id,
            name=name,
            email=email,
            invited_by=invited_by,
            expires_after=expires_after,
            expires_before=expires_before,
        )

        return await self._count(where=conditions)

    @typecheck
    async def find_pending_by_email(
        self,
        center_id: uuid_str,
        email: str,
    ) -> MemberInvitation | None:
        now = utc_now()
        return await self._find(
            where=[
                MemberInvitation.center_id == center_id,
                MemberInvitation.email == email,
                MemberInvitation.member_id.is_(None),
                MemberInvitation.expires_at > now,
            ]
        )

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        status: str | None = None,
        name: str | None = None,
        email: str | None = None,
        employment_type: str | None = None,
        expires_from: date | None = None,
        expires_to: date | None = None,
        accepted_from: date | None = None,
        accepted_to: date | None = None,
        ids: list[str] | None = None,
        role_id: str | None = None,
    ) -> tuple[list[MemberInvitation], int]:
        now = utc_now()
        where = [MemberInvitation.center_id == center_id]
        if ids is not None:
            where.append(MemberInvitation.id.in_(ids))
        if status == "pending":
            where.append(MemberInvitation.member_id.is_(None))
            where.append(MemberInvitation.expires_at > now)
        elif status == "accepted":
            where.append(MemberInvitation.member_id.is_not(None))
        elif status == "expired":
            where.append(MemberInvitation.member_id.is_(None))
            where.append(MemberInvitation.expires_at <= now)
        if name:
            where.append(MemberInvitation.name.ilike(f"%{name}%"))
        if email:
            where.append(MemberInvitation.email.ilike(f"%{email}%"))
        if employment_type:
            where.append(MemberInvitation.employment_type == employment_type)
        if role_id is not None:
            where.append(MemberInvitation.role_id == role_id)
        if expires_from:
            where.append(MemberInvitation.expires_at >= datetime.combine(expires_from, time.min))
        if expires_to:
            where.append(MemberInvitation.expires_at <= datetime.combine(expires_to, time.max))
        if accepted_from:
            where.append(MemberInvitation.accepted_at >= datetime.combine(accepted_from, time.min))
        if accepted_to:
            where.append(MemberInvitation.accepted_at <= datetime.combine(accepted_to, time.max))
        col, descending = resolve_sort(
            sort,
            event_columns={"accepted": "accepted_at", "expires": "expires_at"},
        )
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total


    # #
    # helpers

    @staticmethod
    def _build_invitation_filters(
        center_id: uuid_str,
        status: str | None = None,
        search: str | None = None,
        role_id: uuid_str | None = None,
        name: str | None = None,
        email: str | None = None,
        invited_by: uuid_str | None = None,
        expires_after: utc_dt | None = None,
        expires_before: utc_dt | None = None,
    ):
        conditions = [
            MemberInvitation.center_id == center_id,
            MemberInvitation.deleted_at.is_(None),
        ]

        now = utc_now()
        if status == "pending":
            conditions.append(MemberInvitation.member_id.is_(None))
            conditions.append(MemberInvitation.expires_at > now)
        elif status == "accepted":
            conditions.append(MemberInvitation.member_id.is_not(None))
        elif status == "expired":
            conditions.append(MemberInvitation.member_id.is_(None))
            conditions.append(MemberInvitation.expires_at <= now)

        if search:
            conditions.append(MemberInvitation.name.ilike(f"%{search}%"))

        if role_id is not None:
            conditions.append(MemberInvitation.role_id == role_id)

        if name is not None:
            conditions.append(MemberInvitation.name.ilike(f"%{name}%"))

        if email is not None:
            conditions.append(MemberInvitation.email.ilike(f"%{email}%"))

        if invited_by is not None:
            conditions.append(MemberInvitation.invited_by == invited_by)

        if expires_after is not None:
            conditions.append(MemberInvitation.expires_at >= expires_after)

        if expires_before is not None:
            conditions.append(MemberInvitation.expires_at <= expires_before)

        return conditions
