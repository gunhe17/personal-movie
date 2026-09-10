from ..models import PushToken
from ..repository import PushTokenRepository


class FindPushTokenService:
    def __init__(self, repo: PushTokenRepository):
        self.repo = repo

    async def execute(self, token: str, account_id: str) -> PushToken | None:
        # return
        return await self.repo.find_by_token_and_account(token=token, account_id=account_id)
