from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade import NotificationFacade
from ..schemas import (
    NotificationSettingResponse,
    NotificationSettingListResponse,
)


async def list_settings_handler(
    center_id: str,
    account_id: str,
    uow: UnitOfWork,
) -> NotificationSettingListResponse:
    facade = NotificationFacade(uow)
    settings = await facade.list_settings(center_id, account_id)

    return NotificationSettingListResponse(
        items=[NotificationSettingResponse.model_validate(s) for s in settings],
    )


TOOL = {
    "name": "list_settings_handler",
    "permission": None,
    "purpose": "내 알림 설정 목록을 조회한다.",
    "keywords": ["알림 설정 목록", "알림 환경설정", "setting 목록"],
    "boundaries": "본인 알림 설정 목록(읽기). 변경은 upsert_setting_handler.",
    "output": "본인 알림 설정 목록 (NotificationSettingListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
