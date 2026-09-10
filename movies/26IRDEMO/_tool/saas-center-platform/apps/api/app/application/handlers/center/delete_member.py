from app.core.type import uuid_str
from app.core.exceptions import InvalidOperationException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.center.facade import MemberFacade
from app.modules.role.facade import RoleFacade
from app.modules.role.role.schemas import RoleCode


async def delete_member_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    member_id: str,
    uow: UnitOfWork,
    actor_id: str | None,
) -> None:
    member_facade = MemberFacade(uow)
    role_facade = RoleFacade(uow)

    role_id = await member_facade.get_member_role_id(member_id, center_id)
    role = await role_facade.find_role_with_version(role_id)
    if role and role.code == RoleCode.ADMIN.value:
        raise InvalidOperationException(
            "센터 소유주는 삭제할 수 없습니다. "
            "센터를 삭제하려면 센터 관리에서 센터 전체를 삭제해주세요."
        )

    atomic, _ = await member_facade.delete_member(member_id=member_id, center_id=center_id)
    await emit(
        uow,
        "member_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "delete_member_handler",
    "permission": "delete:member",
    "purpose": "센터에서 특정 멤버를 삭제해 소속을 해제한다.",
    "keywords": ['delete member', "멤버 삭제", "직원 내보내기", "멤버 제거", "퇴사 처리", "소속 해제", "팀원 빼기", "상담사 삭제", "내보내기"],
    "boundaries": "운영자가 '다른' 멤버를 센터에서 삭제하는 도구다. 본인이 스스로 나가려면 leave_center_handler를, 멤버를 지우지 않고 활성·비활성만 바꾸려면 activate_member_handler·deactivate_member_handler를 쓴다. 센터 소유주(ADMIN 역할)는 삭제할 수 없다. 현재 센터에서 멤버 삭제 권한이 있는 사용자만 호출한다.",
    "output": "없음 (멤버 삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {"type": "string", "format": "uuid", "title": "대상 멤버", "description": "삭제할 멤버의 UUID. 현재 센터 소속 멤버여야 한다."},
        },
        "required": ["member_id"],
    },
}
