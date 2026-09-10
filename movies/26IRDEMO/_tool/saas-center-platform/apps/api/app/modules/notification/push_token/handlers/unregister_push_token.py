from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade import NotificationFacade


async def unregister_push_token_handler(
    center_id: str,
    account_id: str,
    token: str,
    uow: UnitOfWork,
) -> bool:
    facade = NotificationFacade(uow)
    result = await facade.unregister_push_token(
        center_id=center_id,
        account_id=account_id,
        token=token,
    )

    return result


TOOL = {
    "name": "unregister_push_token_handler",
    "permission": None,
    "purpose": "푸시 알림용 기기 토큰을 해제한다.",
    "keywords": ["푸시 토큰 해제", "기기 해제", "push token 삭제"],
    "boundaries": "푸시 토큰 '해제'. 등록은 register_push_token_handler.",
    "output": "해제 성공 여부 (bool).",
    "input_schema": {
        "type": "object",
        "properties": {
            "token": {
                "type": "string",
                "title": "대상 토큰",
                "description": "해제할 푸시 토큰 문자열.",
            },
        },
        "required": ["token"],
    },
}
