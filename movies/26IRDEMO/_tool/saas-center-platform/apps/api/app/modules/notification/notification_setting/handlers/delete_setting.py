from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import NotificationFacade

async def delete_setting_handler(
    setting_id: str,
    center_id: str,
    account_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> None:
    facade = NotificationFacade(uow)
    atomic, _setting = await facade.delete_setting(setting_id, center_id, account_id)
    await emit(
        uow,
        "notification_setting_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "delete_setting_handler",
    "permission": None,
    "purpose": "알림 설정을 삭제한다.",
    "keywords": ["알림 설정 삭제", "setting 삭제"],
    "boundaries": "알림 설정 삭제. 목록은 list_settings_handler.",
    "output": "없음 (알림 설정 삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "setting_id": {"type": "string", "format": "uuid", "title": "대상 설정", "description": "삭제할 알림 설정의 UUID."},
        },
        "required": ["setting_id"],
    },
}
