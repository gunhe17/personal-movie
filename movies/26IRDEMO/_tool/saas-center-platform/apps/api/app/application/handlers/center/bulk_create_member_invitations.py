from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.center.facade import MemberInvitationFacade
from app.modules.role.facade import RoleFacade
from app.modules.center.member_invitation.events import MemberInvitationAtomic
from app.modules.center.member_invitation.schemas import (
    MemberInvitationBulkCreate,
    MemberInvitationBulkResponse,
    BulkInvitationResult,
)
from .create_member_invitation import _resolve_inviter_name


async def bulk_create_member_invitations_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: MemberInvitationBulkCreate,
    invited_by: str,
    uow: UnitOfWork,
    actor_id: str | None,
) -> MemberInvitationBulkResponse:
    invitation_facade = MemberInvitationFacade(uow)
    role_facade = RoleFacade(uow)
    inviter_name = await _resolve_inviter_name(uow, invited_by)
    center_name = await invitation_facade.get_center_name(center_id)

    # 역할 검증은 쓰기 전 판정 → 루프 앞단에서, 통과분만 write. 실패는 결과 error로.
    # DB만 쓰는 부분성공 batch = 단일 tx + 1 event/N atomics (application.md §3-1).
    results: list[BulkInvitationResult] = []
    atomics: list[MemberInvitationAtomic] = []
    for item in data.items:
        role = await role_facade.find_role_by_center_and_code(
            center_id, item.role_code.value
        )
        if not role:
            results.append(
                BulkInvitationResult(
                    email=item.email,
                    success=False,
                    error=f"Role not found: {item.role_code.value}",
                )
            )
            continue

        atomic, response, _ = await invitation_facade.create_with_response(
            center_id=center_id,
            invited_by=invited_by,
            name=item.name,
            email=item.email,
            role_id=role.id,
            role_code=role.code,
            role_name=role.name,
            center_name=center_name,
            inviter_name=inviter_name,
            employment_type=item.employment_type.value,
        )
        atomics.append(atomic)
        results.append(
            BulkInvitationResult(
                email=item.email,
                success=True,
                invitation=response,
            )
        )

    # 초대 메일은 member_invitation_created 반응(email_member_invited)이 atomic마다 발송.
    # 커밋·dispatch는 behavior 소유(behavior.md INV-tx).
    await emit(
        uow,
        "member_invitation_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    success_count = sum(1 for r in results if r.success)
    return MemberInvitationBulkResponse(
        total=len(data.items),
        success_count=success_count,
        failure_count=len(results) - success_count,
        results=results,
    )


TOOL = {
    "name": "bulk_create_member_invitations_handler",
    "permission": "write:member_invitation",
    "purpose": "여러 명의 멤버 초대를 한 번에 일괄 생성하고 각자에게 초대 메일을 발송한다.",
    "keywords": [
        "bulk create member invitations",
        "초대 일괄 발송",
        "여러 명 초대",
        "단체 초대",
        "한꺼번에 초대",
        "대량 초대",
        "멤버 일괄 추가",
        "팀원 한번에 부르기",
        "엑셀 초대",
    ],
    "boundaries": "한 요청에 여러 초대를 만드는 도구로, 항목마다 개별 처리해 일부가 실패해도 성공분은 그대로 발송하고 실패분만 결과에 error로 표시한다(부분 실패 허용, 최대 20명). 한 명만 초대하려면 create_member_invitation_handler를, 받은 초대를 수락하려면 accept_member_invitation_handler를 쓴다. 현재 센터에 멤버 초대 권한이 있는 사용자만 호출한다.",
    "output": "일괄 초대 결과, 항목별 성공/실패 (MemberInvitationBulkResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "description": "초대할 멤버 목록(이름·이메일·역할·고용형태, 최대 20명).",
                "items": {"$ref": "#/$defs/MemberInvitationCreate"},
                "maxItems": 20,
                "minItems": 1,
                "title": "초대 목록",
                "type": "array",
            },
        },
        "$defs": {
            "EmploymentType": {
                "enum": ["FULLTIME", "CONTRACT", "FREELANCER"],
                "title": "EmploymentType",
                "type": "string",
            },
            "MemberInvitationCreate": {
                "description": "멤버 초대 생성",
                "properties": {
                    "name": {
                        "maxLength": 100,
                        "minLength": 1,
                        "title": "Name",
                        "type": "string",
                    },
                    "email": {
                        "pattern": "^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$",
                        "title": "Email",
                        "type": "string",
                    },
                    "role_code": {
                        "$ref": "#/$defs/RoleCode",
                        "description": "역할 코드 (ADMIN/MANAGER/COUNSELOR)",
                    },
                    "employment_type": {
                        "$ref": "#/$defs/EmploymentType",
                        "description": "고용형태 (FULLTIME/CONTRACT/FREELANCER)",
                    },
                },
                "required": ["name", "email", "role_code", "employment_type"],
                "title": "MemberInvitationCreate",
                "type": "object",
            },
            "RoleCode": {
                "enum": ["ADMIN", "MANAGER", "COUNSELOR"],
                "title": "RoleCode",
                "type": "string",
            },
        },
        "required": ["items"],
    },
}
