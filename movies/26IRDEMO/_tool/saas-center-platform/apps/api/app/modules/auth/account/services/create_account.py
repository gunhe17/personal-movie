from app.core.exceptions import ConflictException
from app.infrastructure.hash.factory import get_password_hasher

from ..events import AccountAtomic
from ..models import Account
from ..repository import AccountRepository


class CreateAccountService:
    def __init__(self, repo: AccountRepository):
        self.repo = repo

    async def execute(self, *, email: str, password: str) -> tuple[AccountAtomic, Account]:
        # verify
        if await self.repo.exists_email(email=email):
            raise ConflictException("이미 사용 중인 이메일입니다.")

        # create
        hashed_password = get_password_hasher().hash(value=password)
        account = await self.repo.add(
            email=email,
            password=hashed_password,
            is_active=True,
            is_verified=False,
            provider="email",
        )
        return AccountAtomic.created(account=account)
