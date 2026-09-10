from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import NotificationFacade
from ..schemas import NotificationResponse


async def mark_as_read_handler(
    notification_id: str,
    center_id: str,
    account_id: str,
    uow: UnitOfWork,
    event_group_id: str,
) -> NotificationResponse:
    facade = NotificationFacade(uow)
    atomic, notification = await facade.mark_as_read(
        notification_id=notification_id,
        center_id=center_id,
        recipient_id=account_id,
    )
    await emit(
        uow,
        "notification_read",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=account_id,
    )
    return NotificationResponse.model_validate(notification)


TOOL = {
    "name": "mark_as_read_handler",
    "permission": None,
    "purpose": "특정 알림을 읽음 처리한다.",
    "keywords": ["알림 읽음", "읽음 처리", "mark read"],
    "boundaries": "한 알림 '읽음' 처리. 전체는 mark_all_as_read_handler.",
    "output": "읽음 처리된 알림 (NotificationResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "notification_id": {"type": "string", "format": "uuid", "title": "대상 알림", "description": "읽음 처리할 알림의 UUID."},
        },
        "required": ["notification_id"],
    },
}
