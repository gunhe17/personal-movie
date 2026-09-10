from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import MemberInvitationFacade
from app.modules.role.facade import RoleFacade
from app.modules.center.member_invitation.schemas import (
    InvitationStatus,
    MemberInvitationListResponse,
)


async def list_member_invitations_handler(
    center_id: str,
    status: InvitationStatus | None,
    page: int,
    size: int,
    uow: UnitOfWork,
    search: str | None = None,
    role_code: str | None = None,
) -> MemberInvitationListResponse:
    status_value = status.value if status else None
    skip = (page - 1) * size

    invitation_facade = MemberInvitationFacade(uow)
    role_facade = RoleFacade(uow)

    role_id: str | None = None
    if role_code:
        role = await role_facade.find_role_by_center_and_code(center_id, role_code)
        role_id = role.id if role else None

    page_role_ids = await invitation_facade.list_invitation_role_ids(
        center_id=center_id,
        status=status_value,
        search=search,
        role_id=role_id,
        skip=skip,
        limit=size,
    )
    role_map = await role_facade.get_roles_by_ids(page_role_ids)

    return await invitation_facade.list_with_response(
        center_id=center_id,
        role_map=role_map,
        status=status_value,
        search=search,
        role_id=role_id,
        skip=skip,
        limit=size,
        page=page,
        size=size,
    )


TOOL = {
    "name": "list_member_invitations_handler",
    "permission": "read:member_invitation",
    "purpose": "센터의 멤버 초대 목록을 상태·검색·역할로 거르고 페이지 단위로 조회한다.",
    "keywords": [
        "list member invitations",
        "초대 목록",
        "멤버 초대 조회",
        "초대 현황",
        "초대장 목록",
        "invitation 목록",
    ],
    "boundaries": "센터의 멤버 '초대' 목록(읽기 전용). 초대 생성/수락 등은 별도 핸들러. 멤버 목록 자체는 list_members_enriched_handler.",
    "output": "멤버 초대 목록 (MemberInvitationListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": ["pending", "accepted", "expired"],
                "title": "상태 필터",
                "description": "초대 상태 필터(선택).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "이름·이메일 검색어(선택).",
            },
            "role_code": {
                "type": "string",
                "title": "역할 코드 필터",
                "description": "역할 코드 필터(선택).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": ["page", "size"],
    },
}
