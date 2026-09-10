from app.core.logger import get_logger
from ..repository import PushTokenRepository
from ..models import PushToken

logger = get_logger(__name__)

class RegisterTokenService:
    def __init__(self, repo: PushTokenRepository):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        token: str,
        center_id: str | None = None,
        device_info: str | None = None,
        platform: str = "web",
    ) -> PushToken:
        # load
        existing = await self.repo.find_by_token(token=token)

        # return
        if existing:
            reactivated = await self.repo.update_in_place(
                id=existing.id,
                center_id=center_id,
                account_id=account_id,
                is_active=True,
                device_info=device_info,
                platform=platform,
            )
            logger.info(f"Push token reactivated: ...{token[-8:]} ({platform})")
            return reactivated

        push_token = await self.repo.add(
            center_id=center_id,
            account_id=account_id,
            token=token,
            device_info=device_info,
            platform=platform,
            is_active=True,
        )
        logger.info(f"Push token registered: ...{token[-8:]}")
        return push_token

