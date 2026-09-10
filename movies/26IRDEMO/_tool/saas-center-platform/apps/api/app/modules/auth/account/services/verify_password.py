from app.core.exceptions import PermissionDeniedException
from app.infrastructure.hash.factory import get_password_hasher

from ..repository import AccountRepository


class VerifyPasswordService:
    def __init__(self, repo: AccountRepository):
        self.repo = repo

    async def execute(self, account_id: str, password: str) -> bool:
        # load
        account = await self.repo.get_by_id(id=account_id)

        # verify
        if not get_password_hasher().verify(hash=account.password, value=password):
            raise PermissionDeniedException("비밀번호가 일치하지 않습니다")

        return True
