from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import AdminRefreshToken


class AdminRefreshTokenRepository(PostgresRepository[AdminRefreshToken]):
    model = AdminRefreshToken

    # #
    # command

    @typecheck
    async def add(
        self,
        admin_account_id: uuid_str,
        token_hash: str,
        expires_at: utc_dt,
        device_info: str | None = None,
        ip_address: str | None = None,
        parent_token_id: uuid_str | None = None,
    ) -> AdminRefreshToken:
        return await super().add(
            AdminRefreshToken(
                admin_account_id=admin_account_id,
                token_hash=token_hash,
                expires_at=expires_at,
                device_info=device_info,
                ip_address=ip_address,
                parent_token_id=parent_token_id,
            )
        )


    @typecheck
    async def update_used(self, id: uuid_str, used_at: utc_dt) -> None:
        token = await self.find_by_id(id)
        if token is not None:
            token.used_at = used_at
            await self._session.flush()

    # #
    # query

    @typecheck
    async def find_by_token_hash(self, token_hash: str) -> AdminRefreshToken | None:
        return await self._find_by(column="token_hash", value=token_hash)

    @typecheck
    async def list_active_by_account(
        self, admin_account_id: uuid_str
    ) -> list[AdminRefreshToken]:
        return await self._filter(
            where=[
                AdminRefreshToken.admin_account_id == admin_account_id,
                AdminRefreshToken.used_at.is_(None),
            ]
        )
