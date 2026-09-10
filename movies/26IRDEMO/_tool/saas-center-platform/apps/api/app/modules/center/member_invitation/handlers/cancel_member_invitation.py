from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.member_invitation_facade import MemberInvitationFacade


async def cancel_member_invitation_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    invitation_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> None:
    facade = MemberInvitationFacade(uow)
    atomic, _ = await facade.cancel(center_id, invitation_id)
    await emit(
        uow,
        "member_invitation_cancelled",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "cancel_member_invitation_handler",
    "permission": "write:member_invitation",
    "purpose": "보낸 멤버 초대를 취소한다.",
    "keywords": ['cancel member invitation', "초대 취소", "멤버 초대 철회", "invitation 취소"],
    "boundaries": "발송한 멤버 초대를 '취소'. 초대 목록은 application의 list_member_invitations_handler.",
    "output": "없음 (초대 취소).",
    "input_schema": {
        "type": "object",
        "properties": {
            "invitation_id": {"type": "string", "format": "uuid", "title": "대상 초대", "description": "취소할 멤버 초대의 UUID."},
        },
        "required": ["invitation_id"],
    },
}
