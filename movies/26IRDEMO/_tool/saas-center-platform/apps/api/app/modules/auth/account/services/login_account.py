from app.core.exceptions import PermissionDeniedException, UnauthorizedException
from app.infrastructure.hash.factory import get_password_hasher

from ..models import Account
from ..repository import AccountRepository


class LoginAccountService:
    def __init__(
        self,
        repo: AccountRepository,
    ):
        self.repo = repo

    async def execute(self, email: str, password: str) -> Account:
        # load
        account = await self.repo.find_by_email(email=email)

        # verify
        if not account or not get_password_hasher().verify(
            hash=account.password, value=password
        ):
            raise UnauthorizedException("Invalid email or password")
        if not account.is_active:
            raise PermissionDeniedException("Account is inactive")

        # return
        return account
