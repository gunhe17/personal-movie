from sqlalchemy import select
from sqlalchemy import update as sql_update

from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import Account


class AccountRepository(PostgresRepository[Account]):
    model = Account

    # #
    # command

    @typecheck
    async def add(
        self,
        email: str,
        password: str,
        is_active: bool = True,
        is_verified: bool = False,
        provider: str = "email",
        provider_id: str | None = None,
    ) -> Account:
        return await super().add(
            Account(
                email=email,
                password=password,
                is_active=is_active,
                is_verified=is_verified,
                provider=provider,
                provider_id=provider_id,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        last_login_at: utc_dt = unset,
        is_active: bool = unset,
        password: str = unset,
    ) -> Account | None:
        return await self.update_fields(
            id,
            last_login_at=last_login_at,
            is_active=is_active,
            password=password,
        )

    @typecheck
    async def increment_token_version(self, id: uuid_str) -> Account | None:
        stmt = (
            sql_update(Account)
            .where(Account.id == id)
            .values(token_version=Account.token_version + 1)
            .returning(Account)
        )
        model = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return model

    # #
    # query

    @typecheck
    async def find_by_id_including_deleted(self, id: uuid_str) -> Account | None:
        stmt = select(Account).where(Account.id == id)
        return (await self._session.execute(stmt)).scalar_one_or_none()

    @typecheck
    async def find_by_email(self, email: str) -> Account | None:
        stmt = select(Account).where(Account.email == email)
        return (await self._session.execute(stmt)).scalar_one_or_none()

    @typecheck
    async def exists_email(self, email: str) -> bool:
        return await self.find_by_email(email=email) is not None

    @typecheck
    async def list_by_ids(self, account_ids: list[str]) -> list[Account]:
        if not account_ids:
            return []
        stmt = select(Account).where(Account.id.in_(account_ids))
        return await self._scalars(stmt)
