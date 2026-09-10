from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..repository import RefreshTokenRepository
from ..services import RevokeDeviceService
from ..schemas import RevokeDeviceRequest, RevokeDeviceResponse


async def revoke_device_handler(
    account_id: str,
    data: RevokeDeviceRequest,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> RevokeDeviceResponse:
    token_repo = uow.repo(RefreshTokenRepository)

    service = RevokeDeviceService(token_repo)
    atomic, _token = await service.execute(
        account_id=account_id,
        session_id=data.session_id,
    )
    await emit(
        uow,
        "refresh_token_revoked",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
    )

    return RevokeDeviceResponse(message="Device session revoked successfully")


TOOL = {
    "name": "revoke_device_handler",
    "permission": None,
    "purpose": "특정 로그인 기기(세션)를 해제한다.",
    "keywords": ["기기 해제", "세션 로그아웃", "디바이스 제거", "revoke device"],
    "boundaries": "한 기기의 세션을 끊는다(원격 로그아웃). 목록은 list_devices_handler.",
    "output": "기기 로그아웃 결과 (RevokeDeviceResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {
                "title": "대상 세션",
                "type": "string",
                "format": "uuid",
                "description": "로그아웃(폐기)할 기기 세션의 UUID.",
            },
        },
        "required": ["session_id"],
    },
}
