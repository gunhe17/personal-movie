from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.admin_account_management.models import AdminAccountInvitation
from app.modules.platform_admin.admin_account_management.repository import (
    AdminAccountInvitationRepository,
)

INVITATION_EXPIRE_DAYS = 7


class UpsertInvitationService:
    def __init__(
        self,
        repo: AdminAccountInvitationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        email: str,
        name: str,
        role: str,
        invited_by: str,
    ) -> tuple[AdminAuditAtomic, AdminAccountInvitation]:
        expires_at = utc_now() + timedelta(days=INVITATION_EXPIRE_DAYS)

        # 기존 pending 초대가 있으면 upsert
        existing = await self.repo.find_pending_by_email(email)
        if existing:
            invitation = await self.repo.update_invitation(
                id=existing.id,
                name=name,
                role=role,
                invited_by=invited_by,
                expires_at=expires_at,
                token="",
            )
        else:
            invitation = await self.repo.add(
                email=email,
                name=name,
                role=role,
                invited_by=invited_by,
                expires_at=expires_at,
                token="",
            )

        atomic = AdminAuditAtomic(
            _act="invited",
            _entity_name="admin_account",
            _entity_id=invitation.id,
            _payload={"data": {"id": invitation.id, "email": invitation.email, "role": invitation.role}},
        )
        return atomic, invitation
