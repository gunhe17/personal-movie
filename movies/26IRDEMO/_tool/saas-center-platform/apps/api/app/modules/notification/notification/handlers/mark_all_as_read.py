from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import NotificationFacade
from ..schemas import MarkAllReadResponse


async def mark_all_as_read_handler(
    center_id: str,
    account_id: str,
    uow: UnitOfWork,
    event_group_id: str,
) -> MarkAllReadResponse:
    facade = NotificationFacade(uow)
    atomics, updated_count = await facade.mark_all_as_read(
        center_id=center_id,
        recipient_id=account_id,
    )
    await emit(
        uow,
        "notification_all_read",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=account_id,
    )
    return MarkAllReadResponse(updated_count=updated_count)


TOOL = {
    "name": "mark_all_as_read_handler",
    "permission": None,
    "purpose": "모든 알림을 읽음 처리한다.",
    "keywords": ["전체 읽음", "모두 확인", "mark all read", "알림 모두 읽기"],
    "boundaries": "모든 알림 '일괄 읽음'. 개별은 mark_as_read_handler.",
    "output": "일괄 읽음 처리 결과 (MarkAllReadResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
        },
        "required": [],
    },
}
