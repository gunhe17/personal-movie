from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade import NotificationFacade
from ..schemas import UnreadCountResponse


async def get_unread_count_handler(
    center_id: str,
    account_id: str,
    uow: UnitOfWork,
) -> UnreadCountResponse:
    facade = NotificationFacade(uow)
    return await facade.get_unread_count_with_response(
        center_id=center_id,
        recipient_id=account_id,
    )


TOOL = {
    "name": "get_unread_count_handler",
    "permission": None,
    "purpose": "읽지 않은 알림 개수를 조회한다.",
    "keywords": ["안읽은 알림 수", "미확인 알림", "unread count", "뱃지 수"],
    "boundaries": "미읽음 알림 '개수'(읽기). 목록은 list_notifications_handler.",
    "output": "읽지 않은 알림 개수 (UnreadCountResponse).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
