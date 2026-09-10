from app.core.schemas import MessageResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.admin_account_management.repository import (
    AdminAccountManagementRepository,
    AdminAccountInvitationRepository,
)
from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.infrastructure.token.factory import get_token
from app.modules.platform_admin.admin_account_management.schemas import AcceptInvitationRequest
from app.modules.platform_admin.admin_account_management.services.create_account_from_invitation import (
    CreateAccountFromInvitationService,
)
from app.modules.platform_admin.admin_account_management.services.get_valid_invitation import (
    GetValidInvitationService,
)


async def accept_admin_invitation_handler(
    data: AcceptInvitationRequest,
    uow: UnitOfWork,
    *,
    event_group_id: str,
    ip: str | None = None,
) -> MessageResponse:
    account_repo = uow.repo(AdminAccountManagementRepository)
    invitation_repo = uow.repo(AdminAccountInvitationRepository)

    # 토큰 검증
    payload = get_token().decode_admin_invitation_token(data.token)
    if payload is None:
        raise InvalidOperationException("유효하지 않거나 만료된 초대 링크입니다")

    invitation_id = payload.get("invitation_id")
    email = payload.get("email")
    name = payload.get("name")
    role = payload.get("role")
    if not all([invitation_id, email, name, role]):
        raise InvalidOperationException("초대 토큰 정보가 올바르지 않습니다")

    invitation = await GetValidInvitationService(invitation_repo).execute(invitation_id)

    account = await CreateAccountFromInvitationService(account_repo).execute(
        email=email,
        name=name,
        role=role,
        password=data.password,
    )

    await invitation_repo.update_accepted(id=invitation.id, accepted_at=utc_now())

    await emit(
        uow,
        "admin_account_invitation_accepted",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="accepted",
            _entity_name="admin_account_invitation",
            _entity_id=invitation.id,
            _payload={"data": {"admin_account_id": account.id, "role": role}},
        )],
        actor_id=account.id,
        actor_type="admin",
        ip_address=ip,
    )

    return MessageResponse(message="계정이 생성되었습니다. 로그인해주세요.")


TOOL = {
    "name": 'accept_admin_invitation_handler',
    "permission": None,
    "purpose": '운영자 초대를 수락해 어드민 계정을 생성한다.',
    "keywords": ['초대 수락', '어드민 가입', 'admin invitation 수락'],
    "boundaries": "운영자 초대를 받아 계정 '생성'. 초대 발송은 invite_admin_account_handler.",
    "output": '초대 수락 결과 메시지 (MessageResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'token': {'title': '초대 토큰', 'type': 'string', 'description': '이메일로 받은 초대 토큰.'},
            'password': {'title': '비밀번호', 'type': 'string', 'description': '새로 설정할 로그인 비밀번호.'},
        },
        "required": ['token', 'password'],
    },
}
