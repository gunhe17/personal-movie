from datetime import datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..audit.repository import CenterLinkAuditRepository
from ..audit.services import RecordAuditService
from ..invitation.events import CenterLinkInvitationAtomic
from ..invitation.models import CenterLinkInvitation
from ..invitation.repository import CenterLinkInvitationRepository
from ..invitation.services import (
    ClaimInvitationService,
    GetValidInvitationService,
    IssueInvitationService,
    ListValidInvitationsService,
    RestoreInvitationService,
)
from ..link.models import CenterLink
from ..link.repository import CenterLinkRepository
from ..link.services import (
    CreateLinkService,
    ListLinksByClientService,
    ListLinksByFamilyService,
    ListLinksByGuardianService,
    ListLinksByInvitationService,
    RevokeLinkService,
)


class CenterLinkFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    # invitation

    async def issue_invitation(
        self,
        *,
        center_id: str,
        guardian_client_id: str,
        issued_by_member_id: str,
        now: datetime,
    ) -> tuple[CenterLinkInvitationAtomic, CenterLinkInvitation]:
        return await IssueInvitationService(
            self._uow.repo(CenterLinkInvitationRepository)
        ).execute(
            center_id=center_id,
            guardian_client_id=guardian_client_id,
            issued_by_member_id=issued_by_member_id,
            now=now,
        )

    async def restore_invitation(self, *, invitation_id: str) -> None:
        await RestoreInvitationService(
            self._uow.repo(CenterLinkInvitationRepository)
        ).execute(invitation_id=invitation_id)

    async def get_valid_invitation(
        self,
        *,
        code: str,
        now: datetime,
    ) -> CenterLinkInvitation:
        return await GetValidInvitationService(
            self._uow.repo(CenterLinkInvitationRepository)
        ).execute(code=code, now=now)

    async def claim_invitation(
        self,
        *,
        invitation_id: str,
        person_id: str,
        now: datetime,
    ) -> CenterLinkInvitation | None:
        return await ClaimInvitationService(
            self._uow.repo(CenterLinkInvitationRepository)
        ).execute(invitation_id=invitation_id, person_id=person_id, now=now)

    async def list_valid_invitations(
        self,
        *,
        center_id: str,
        guardian_client_id: str,
        now: datetime,
    ) -> list[CenterLinkInvitation]:
        return await ListValidInvitationsService(
            self._uow.repo(CenterLinkInvitationRepository)
        ).execute(
            center_id=center_id,
            guardian_client_id=guardian_client_id,
            now=now,
        )

    # link

    async def create_link(
        self,
        *,
        family_id: str,
        profile_id: str,
        person_id: str,
        center_id: str,
        client_id: str,
        guardian_client_id: str,
        invitation_id: str | None,
        now: datetime,
        linked_at: datetime | None = None,
    ) -> CenterLink:
        return await CreateLinkService(self._uow.repo(CenterLinkRepository)).execute(
            family_id=family_id,
            profile_id=profile_id,
            person_id=person_id,
            center_id=center_id,
            client_id=client_id,
            guardian_client_id=guardian_client_id,
            invitation_id=invitation_id,
            now=now,
            linked_at=linked_at,
        )

    async def list_links_by_family(
        self,
        *,
        family_id: str,
        alive_only: bool = False,
    ) -> list[CenterLink]:
        return await ListLinksByFamilyService(
            self._uow.repo(CenterLinkRepository)
        ).execute(family_id=family_id, alive_only=alive_only)

    async def list_links_by_client(
        self,
        *,
        center_id: str,
        client_id: str,
    ) -> list[CenterLink]:
        return await ListLinksByClientService(
            self._uow.repo(CenterLinkRepository)
        ).execute(center_id=center_id, client_id=client_id)

    async def list_links_by_invitation(
        self,
        *,
        invitation_id: str,
    ) -> list[CenterLink]:
        return await ListLinksByInvitationService(
            self._uow.repo(CenterLinkRepository)
        ).execute(invitation_id=invitation_id)

    async def list_links_by_guardian(
        self,
        *,
        center_id: str,
        guardian_client_id: str,
    ) -> list[CenterLink]:
        return await ListLinksByGuardianService(
            self._uow.repo(CenterLinkRepository)
        ).execute(center_id=center_id, guardian_client_id=guardian_client_id)

    async def revoke_link(
        self,
        *,
        link_id: str,
        family_id: str,
        reason: str,
        now: datetime,
    ) -> CenterLink:
        return await RevokeLinkService(self._uow.repo(CenterLinkRepository)).execute(
            link_id=link_id,
            family_id=family_id,
            reason=reason,
            now=now,
        )

    # audit

    async def record_audit(
        self,
        *,
        center_id: str,
        actor_type: str,
        action: str,
        link_id: str | None = None,
        invitation_id: str | None = None,
        actor_id: str | None = None,
        snapshot: dict | None = None,
    ) -> None:
        await RecordAuditService(self._uow.repo(CenterLinkAuditRepository)).execute(
            center_id=center_id,
            actor_type=actor_type,
            action=action,
            link_id=link_id,
            invitation_id=invitation_id,
            actor_id=actor_id,
            snapshot=snapshot,
        )
