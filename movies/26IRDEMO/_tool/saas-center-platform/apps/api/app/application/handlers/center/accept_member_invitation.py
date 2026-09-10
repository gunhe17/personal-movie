from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import MemberInvitationFacade
from app.modules.event import emit
from app.modules.role.facade import RoleFacade
from app.modules.center.member_invitation.schemas import MemberInvitationResponse
from app.modules.role.role.schemas import RoleCode


async def accept_member_invitation_handler(
    invitation_id: str,
    person_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> MemberInvitationResponse:
    # 회원가입 완료 시 호출
    invitation_facade = MemberInvitationFacade(uow)
    role_facade = RoleFacade(uow)

    role_id = await invitation_facade.get_invitation_role_id(invitation_id)
    role = await role_facade.find_role_with_version(role_id)

    atomics, invitation, _member = await invitation_facade.accept(
        invitation_id=invitation_id,
        person_id=person_id,
        is_admin_role=bool(role and role.code == RoleCode.ADMIN.value),
    )

    await emit(
        uow,
        "member_invitation_accepted",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=invitation.center_id,
        actor_id=actor_id,
    )

    return MemberInvitationResponse(
        id=invitation.id,
        center_id=invitation.center_id,
        invited_by=invitation.invited_by,
        name=invitation.name,
        email=invitation.email,
        role_code=role.code if role else "Unknown",
        role_name=role.name if role else "Unknown",
        employment_type=invitation.employment_type,
        member_id=invitation.member_id,
        accepted_at=invitation.accepted_at,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
    )


TOOL = {
    "name": "accept_member_invitation_handler",
    "agent_exposed": False,
    "permission": None,
    "purpose": "초대받은 사람이 회원가입을 마친 뒤 그 초대를 수락해 실제 센터 멤버로 등록한다.",
    "keywords": ['accept member invitation', "초대 수락", "초대 받기", "멤버 등록", "센터 합류", "입사 처리", "초대 승인", "가입 완료", "팀 합류"],
    "boundaries": "초대 토큰/ID를 받아 그 초대를 '수락'해 멤버 자격을 확정하는 도구다. 초대를 새로 보내려면 create_member_invitation_handler를, 여러 명을 한 번에 보내려면 bulk_create_member_invitations_handler를 쓴다. 이미 회원가입을 마친 본인이 호출하며, 운영자가 대신 수락하지 않는다.",
    "output": "수락된 초대 (MemberInvitationResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "invitation_id": {"type": "string", "format": "uuid", "title": "대상 초대", "description": "수락할 초대 건의 UUID. 초대 메일/링크에 담겨 전달된 값."},
        },
        "required": ["invitation_id"],
    },
}
