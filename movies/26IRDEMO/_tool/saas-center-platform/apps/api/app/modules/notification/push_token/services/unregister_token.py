from app.core.logger import get_logger
from ..repository import PushTokenRepository

logger = get_logger(__name__)

class UnregisterTokenService:
    def __init__(self, repo: PushTokenRepository):
        self.repo = repo

    async def execute(self, token: str) -> bool:
        # load
        existing = await self.repo.find_by_token(token=token)
        if not existing:
            return False

        # return
        await self.repo.update_inactive_by_token(token=token)
        logger.info(f"Push token unregistered: ...{token[-8:]}")
        return True

