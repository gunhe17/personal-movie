from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade import NotificationFacade
from ..schemas import PushTokenRegister, PushTokenResponse


async def register_push_token_handler(
    center_id: str,
    account_id: str,
    data: PushTokenRegister,
    uow: UnitOfWork,
) -> PushTokenResponse:
    facade = NotificationFacade(uow)
    push_token = await facade.register_push_token(
        center_id=center_id,
        account_id=account_id,
        token=data.token,
        device_info=data.device_info,
        platform=data.platform,
    )

    return PushTokenResponse.model_validate(push_token)


TOOL = {
    "name": "register_push_token_handler",
    "permission": None,
    "purpose": "푸시 알림용 기기 토큰을 등록한다.",
    "keywords": ["푸시 토큰 등록", "기기 등록", "push token", "알림 기기"],
    "boundaries": "푸시 토큰 '등록'. 해제는 unregister_push_token_handler.",
    "output": "등록된 푸시 토큰 (PushTokenResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "token": {
                "title": "기기 토큰",
                "type": "string",
                "description": "푸시 발송용 기기 토큰(FCM 등).",
            },
            "device_info": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "기기 정보",
                "description": "기기 식별 정보(선택).",
            },
            "platform": {
                "default": "web",
                "title": "플랫폼",
                "type": "string",
                "description": "기기 플랫폼(web/ios/android, 기본 web).",
            },
        },
        "required": ["token"],
    },
}
