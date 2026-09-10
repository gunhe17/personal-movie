from sqlalchemy import or_, update

from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import PushToken


class PushTokenRepository(PostgresRepository[PushToken]):
    model = PushToken

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str | None,
        account_id: uuid_str,
        token: str,
        device_info: str | None = None,
        platform: str = "web",
        is_active: bool = True,
    ) -> PushToken:
        return await super().add(
            PushToken(
                center_id=center_id,
                account_id=account_id,
                token=token,
                device_info=device_info,
                platform=platform,
                is_active=is_active,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        center_id: uuid_str = unset,
        account_id: uuid_str = unset,
        is_active: bool = unset,
        device_info: str | None = unset,
        platform: str = unset,
    ) -> PushToken | None:
        return await self.update_fields(
            id,
            center_id=center_id,
            account_id=account_id,
            is_active=is_active,
            device_info=device_info,
            platform=platform,
        )

    @typecheck
    async def update_inactive_by_token(self, token: str) -> None:
        stmt = (
            update(PushToken)
            .where(PushToken.token == token)
            .values(is_active=False)
        )
        await self._session.execute(stmt)

    # #
    # query

    @typecheck
    async def find_by_token(self, token: str) -> PushToken | None:
        return await self._find_by(column="token", value=token)

    @typecheck
    async def find_by_token_and_account(
        self,
        token: str,
        account_id: uuid_str,
    ) -> PushToken | None:
        return await self._find(
            where=[PushToken.token == token, PushToken.account_id == account_id]
        )

    @typecheck
    async def list_active_by_account(
        self,
        center_id: uuid_str,
        account_id: uuid_str,
    ) -> list[PushToken]:
        return await self._filter(
            where=[
                PushToken.center_id == center_id,
                PushToken.account_id == account_id,
                PushToken.is_active.is_(True),
            ]
        )

    @typecheck
    async def list_active_by_accounts(
        self,
        account_ids: list[str],
        center_id: uuid_str | None = None,
    ) -> list[PushToken]:
        if not account_ids:
            return []
        where = [
            PushToken.account_id.in_(account_ids),
            PushToken.is_active.is_(True),
        ]
        if center_id is not None:
            # 앱 토큰(center_id IS NULL)은 전역 — 어느 센터 발신이든 도달한다
            where.append(
                or_(PushToken.center_id == center_id, PushToken.center_id.is_(None))
            )
        return await self._filter(where=where)
