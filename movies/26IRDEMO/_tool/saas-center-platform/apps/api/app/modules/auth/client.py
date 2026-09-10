"""cross-module READ 전용 표면 — DTO 반환(entity 미노출). write는 facade 경유."""
from dataclasses import dataclass

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.auth.account.models import Account
from app.modules.auth.account.repository import AccountRepository


@dataclass(frozen=True)
class AccountRef:
    id: uuid_str
    email: str


def _to_ref(account: Account) -> AccountRef:
    return AccountRef(
        id=account.id,
        email=account.email,
    )


class AccountClient:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._repo = uow.repo(AccountRepository)

    async def find_by_email(
        self,
        email: str,
    ) -> AccountRef | None:
        account = await self._repo.find_by_email(email)
        return _to_ref(account) if account else None
