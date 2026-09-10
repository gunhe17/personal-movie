from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import (
    AppPushTokenRegisterRequest,
    AppPushTokenResponse,
)
from app.modules.notification.facade import NotificationFacade

GLOBAL_CATEGORY = "*"


async def register_app_push_token_handler(
    data: AppPushTokenRegisterRequest,
    *,
    account_id: uuid_str,
    uow: UnitOfWork,
) -> AppPushTokenResponse:
    async with uow:
        facade = NotificationFacade(uow)

        # center_id 없음 = 계정 전역 토큰. 보호자는 센터 N곳에 걸쳐 한 기기를 쓴다
        token = await facade.register_push_token(
            account_id=account_id,
            token=data.token,
            device_info=data.device_info,
            platform=data.platform,
        )

        # OS 권한 승인이 곧 동의 — 설정 행이 없으면 푸시가 조용히 꺼진 채 남는다
        existing = await facade.find_effective_setting(
            account_id=account_id,
            category=GLOBAL_CATEGORY,
        )
        if existing is None:
            await facade.upsert_setting(
                account_id=account_id,
                category=GLOBAL_CATEGORY,
                channel_in_app=True,
                channel_push=True,
                channel_alarmtalk=False,
            )

        return AppPushTokenResponse(
            id=token.id,
            platform=token.platform,
            is_active=token.is_active,
        )
