from sqlalchemy import select

from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import AdminAccount


class AdminAccountRepository(PostgresRepository[AdminAccount]):
    model = AdminAccount

    # #
    # command

    @typecheck
    async def update_security_state(
        self,
        id: uuid_str,
        is_active: bool,
        failed_login_count: int,
        locked_until: utc_dt | None,
    ) -> AdminAccount | None:
        return await self.update_fields(
            id,
            is_active=is_active,
            failed_login_count=failed_login_count,
            locked_until=locked_until,
        )

    @typecheck
    async def update_last_login(self, id: uuid_str, *, last_login_at: utc_dt) -> AdminAccount | None:
        return await self.update_fields(id, last_login_at=last_login_at)

    @typecheck
    async def update_password(self, id: uuid_str, password: str) -> AdminAccount | None:
        return await self.update_fields(id, password=password)

    # #
    # query

    @typecheck
    async def find_by_email(self, email: str) -> AdminAccount | None:
        return await self._find_by(column="email", value=email)

    @typecheck
    async def aggregate_name_map_by_ids(
        self,
        ids: list,
    ) -> dict:
        if not ids:
            return {}
        # 이름 재구성용 — soft-delete된 계정도 포함(표시명 유실 방지)
        stmt = select(AdminAccount.id, AdminAccount.name).where(AdminAccount.id.in_(ids))
        rows = (await self._session.execute(stmt)).all()
        return {row.id: row.name for row in rows}

    @typecheck
    async def aggregate_email_map_by_ids(
        self,
        ids: list,
    ) -> dict:
        if not ids:
            return {}
        # 감사 표시용 — soft-delete된 계정도 포함(표시 유실 방지)
        stmt = select(AdminAccount.id, AdminAccount.email).where(AdminAccount.id.in_(ids))
        rows = (await self._session.execute(stmt)).all()
        return {row.id: row.email for row in rows}

    @typecheck
    async def list_ids_by_email_ilike(
        self,
        search: str,
    ) -> list[str]:
        stmt = select(AdminAccount.id).where(AdminAccount.email.ilike(f"%{search}%"))
        return list((await self._session.execute(stmt)).scalars().all())
