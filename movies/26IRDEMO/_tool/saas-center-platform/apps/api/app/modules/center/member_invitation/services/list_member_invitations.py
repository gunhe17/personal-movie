from datetime import datetime

from ..models import MemberInvitation
from ..repository import MemberInvitationRepository


class ListMemberInvitationsService:
    def __init__(self, repo: MemberInvitationRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        status: str | None = None,
        search: str | None = None,
        role_id: str | None = None,
        skip: int = 0,
        limit: int = 100,
        name: str | None = None,
        email: str | None = None,
        invited_by: str | None = None,
        expires_after: datetime | None = None,
        expires_before: datetime | None = None,
    ) -> tuple[list[MemberInvitation], int]:
        # load
        invitations = await self.repo.list_by_center(
            center_id=center_id,
            status=status,
            search=search,
            role_id=role_id,
            skip=skip,
            limit=limit,
            name=name,
            email=email,
            invited_by=invited_by,
            expires_after=expires_after,
            expires_before=expires_before,
        )
        total = await self.repo.count_by_center(
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

        # return
        return invitations, total
