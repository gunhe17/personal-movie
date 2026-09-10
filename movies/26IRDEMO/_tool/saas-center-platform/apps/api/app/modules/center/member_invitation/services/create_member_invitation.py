from datetime import timedelta

from app.core.datetime_utils import utc_now

from ..events import MemberInvitationAtomic
from ..models import MemberInvitation
from ..repository import MemberInvitationRepository


INVITATION_EXPIRY_DAYS = 7


class CreateMemberInvitationService:
    def __init__(self, repo: MemberInvitationRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        invited_by: str,
        name: str,
        email: str,
        role_id: str,
        employment_type: str | None = None,
    ) -> tuple[MemberInvitationAtomic, MemberInvitation]:
        # load
        expires_at = utc_now() + timedelta(days=INVITATION_EXPIRY_DAYS)
        existing = await self.repo.find_pending_by_email(
            center_id=center_id,
            email=email,
        )

        # update
        if existing:
            invitation = await self.repo.update_pending(
                invitation_id=existing.id,
                invited_by=invited_by,
                name=name,
                role_id=role_id,
                employment_type=employment_type,
                expires_at=expires_at,
            )
            return MemberInvitationAtomic.created(invitation=invitation)

        # return
        invitation = await self.repo.add(
            center_id=center_id,
            invited_by=invited_by,
            name=name,
            email=email,
            role_id=role_id,
            employment_type=employment_type,
            expires_at=expires_at,
        )
        return MemberInvitationAtomic.created(invitation=invitation)
