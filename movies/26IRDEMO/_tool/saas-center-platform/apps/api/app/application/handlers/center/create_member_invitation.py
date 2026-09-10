from app.core.type import uuid_str
from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.center.facade import MemberInvitationFacade
from app.modules.person.facade import PersonFacade
from app.modules.role.facade import RoleFacade
from app.modules.center.member_invitation.schemas import (
    MemberInvitationCreate,
    MemberInvitationResponse,
)


async def _resolve_inviter_name(
    uow: UnitOfWork,
    invited_by: str,
) -> str:
    # invited_by = account_id(모델 reference=accounts) → 계정으로 person 해석
    person_facade = PersonFacade(uow)
    inviter = await person_facade.find_person_by_account(invited_by)
    return inviter.name if inviter else "관리자"


async def create_member_invitation_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: MemberInvitationCreate,
    invited_by: str,
    uow: UnitOfWork,
    actor_id: str | None,
) -> MemberInvitationResponse:
    invitation_facade = MemberInvitationFacade(uow)
    role_facade = RoleFacade(uow)

    role = await role_facade.find_role_by_center_and_code(
        center_id, data.role_code.value
    )
    if not role:
        raise EntityNotFoundException(f"Role not found: {data.role_code.value}")

    # 초대 이메일은 member_invitation_created 반응(email_member_invited_handler)이 발송
    atomic, invitation = await invitation_facade.create_invitation(
        center_id=center_id,
        invited_by=invited_by,
        name=data.name,
        email=data.email,
        role_id=role.id,
        employment_type=data.employment_type.value,
    )
    await emit(
        uow,
        "member_invitation_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return MemberInvitationResponse(
        id=invitation.id,
        center_id=invitation.center_id,
        invited_by=invitation.invited_by,
        name=invitation.name,
        email=invitation.email,
        role_code=role.code,
        role_name=role.name,
        employment_type=invitation.employment_type,
        member_id=invitation.member_id,
        accepted_at=invitation.accepted_at,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
    )


TOOL = {
    "name": "create_member_invitation_handler",
    "permission": "write:member_invitation",
    "purpose": "새 멤버 한 명을 센터에 초대해 초대 건을 생성하고 초대 메일을 발송한다.",
    "keywords": [
        "create member invitation",
        "멤버 초대",
        "직원 초대",
        "초대 보내기",
        "팀원 추가",
        "초대 메일",
        "상담사 초대",
        "사람 부르기",
        "초대장 발송",
    ],
    "boundaries": "한 명을 초대하는 도구다. 여러 명을 한 번에 초대하려면 bulk_create_member_invitations_handler를, 받은 초대를 수락하려면 accept_member_invitation_handler를 쓴다. 멤버를 바로 만드는 게 아니라 초대를 보내고 상대가 수락해야 멤버가 된다. 현재 센터에 초대 권한이 있는 사용자만 호출한다.",
    "output": "생성된 초대 (MemberInvitationResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "maxLength": 100,
                "minLength": 1,
                "title": "이름",
                "type": "string",
                "description": "초대할 멤버 이름.",
            },
            "email": {
                "pattern": "^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$",
                "title": "이메일",
                "type": "string",
                "description": "초대할 멤버 이메일.",
            },
            "role_code": {
                "$ref": "#/$defs/RoleCode",
                "description": "역할 코드: ADMIN/MANAGER/COUNSELOR.",
            },
            "employment_type": {
                "$ref": "#/$defs/EmploymentType",
                "description": "고용형태: FULLTIME/CONTRACT/FREELANCER.",
            },
        },
        "$defs": {
            "EmploymentType": {
                "enum": ["FULLTIME", "CONTRACT", "FREELANCER"],
                "title": "EmploymentType",
                "type": "string",
            },
            "RoleCode": {
                "enum": ["ADMIN", "MANAGER", "COUNSELOR"],
                "title": "RoleCode",
                "type": "string",
            },
        },
        "required": ["name", "email", "role_code", "employment_type"],
    },
}
