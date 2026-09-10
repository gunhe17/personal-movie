from ..schemas import InviteAdminAccountResponse

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.admin_account_management.repository import (
    AdminAccountManagementRepository,
    AdminAccountInvitationRepository,
)
from app.core.config import settings
from app.infrastructure.token.factory import get_token
from app.modules.platform_admin.admin_account_management.schemas import InviteAdminAccountRequest
from app.modules.platform_admin.admin_account_management.services.upsert_invitation import (
    UpsertInvitationService,
)
from app.modules.platform_admin.admin_account_management.services.verify_admin_email_available import (
    VerifyAdminEmailAvailableService,
)


async def invite_admin_account_handler(
    *,
    data: InviteAdminAccountRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> InviteAdminAccountResponse:
    account_repo = uow.repo(AdminAccountManagementRepository)
    invitation_repo = uow.repo(AdminAccountInvitationRepository)

    await VerifyAdminEmailAvailableService(account_repo).execute(email=data.email)

    atomic, invitation = await UpsertInvitationService(invitation_repo).execute(
        email=data.email,
        name=data.name,
        role=data.role,
        invited_by=actor_id,
    )

    token = get_token().create_admin_invitation_token(
        invitation_id=invitation.id,
        email=data.email,
        name=data.name,
        role=data.role,
        expires_at=invitation.expires_at,
    )
    await invitation_repo.update_token(id=invitation.id, token=token)

    admin_url = getattr(settings, "ADMIN_FRONTEND_URL", "http://localhost:3504")
    invitation_link = f"{admin_url}/accept-admin-invitation?token={token}"

    await emit(
        uow,
        "admin_account_invitation_invited",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return InviteAdminAccountResponse(message="초대가 생성되었습니다", invitation_link=invitation_link)


TOOL = {
    "name": 'invite_admin_account_handler',
    "permission": None,
    "purpose": '새 운영자를 초대한다.',
    "keywords": ['어드민 초대', '관리자 초대', 'admin invite', '운영자 추가'],
    "boundaries": "운영자 전용 — 새 어드민 '초대'(초대 링크 발급). 수락은 accept_admin_invitation_handler.",
    "output": '발급된 초대 정보 — 초대 링크 포함 (InviteAdminAccountResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'email': {'title': '초대 이메일', 'type': 'string', 'format': 'email', 'description': '초대할 운영자의 이메일.'},
            'name': {'title': '이름', 'type': 'string', 'description': '초대할 운영자의 이름.'},
            'role': {'title': '역할', 'type': 'string', 'description': '부여할 운영자 역할.'},
        },
        "required": ['email', 'name', 'role'],
    },
}
