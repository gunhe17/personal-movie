from app.core.datetime_utils import utc_now

from sqlalchemy import or_, update as sql_update

from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository
from app.modules.platform_admin.admin_account.models import AdminAccount

from .models import AdminAccountInvitation


class AdminAccountManagementRepository(PostgresRepository[AdminAccount]):
    model = AdminAccount

    # #
    # command

    @typecheck
    async def add(
        self,
        email: str,
        name: str,
        role: str,
        password: str,
        is_active: bool = True,
    ) -> AdminAccount:
        return await super().add(
            AdminAccount(
                email=email,
                name=name,
                role=role,
                password=password,
                is_active=is_active,
            )
        )

    @typecheck
    async def lock(self, id: uuid_str) -> AdminAccount | None:
        # token_version 증가는 DB-side 원자 연산(강제 로그아웃) — load-후-대입은 race
        stmt = (
            sql_update(AdminAccount)
            .where(AdminAccount.id == id, AdminAccount.deleted_at.is_(None))
            .values(is_active=False, token_version=AdminAccount.token_version + 1)
            .returning(AdminAccount)
        )
        account = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return account

    @typecheck
    async def unlock(self, id: uuid_str) -> AdminAccount | None:
        stmt = (
            sql_update(AdminAccount)
            .where(AdminAccount.id == id, AdminAccount.deleted_at.is_(None))
            .values(is_active=True, failed_login_count=0, locked_until=None)
            .returning(AdminAccount)
        )
        account = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return account

    @typecheck
    async def update_role(self, id: uuid_str, role: str) -> AdminAccount | None:
        stmt = (
            sql_update(AdminAccount)
            .where(AdminAccount.id == id, AdminAccount.deleted_at.is_(None))
            .values(role=role, token_version=AdminAccount.token_version + 1)
            .returning(AdminAccount)
        )
        account = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return account

    @typecheck
    async def remove_by_id(self, id: uuid_str) -> AdminAccount | None:
        # admin 계정 삭제는 비활성화 + 토큰 무효화(강제 로그아웃)를 동반. base soft-delete는 super()로.
        stmt = (
            sql_update(AdminAccount)
            .where(AdminAccount.id == id, AdminAccount.deleted_at.is_(None))
            .values(is_active=False, token_version=AdminAccount.token_version + 1)
        )
        await self._session.execute(stmt)
        return await super().remove_by_id(id)

    # #
    # query

    @typecheck
    async def find_by_email(self, email: str) -> AdminAccount | None:
        return await self._find_by(column="email", value=email)

    @typecheck
    async def list_accounts_with_page(
        self,
        search: str | None = None,
        role: str | None = None,
        is_active: bool | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[AdminAccount], Page]:
        where = []
        if is_active is not None:
            where.append(AdminAccount.is_active.is_(is_active))
        if role:
            where.append(AdminAccount.role == role)
        if search:
            pattern = f"%{search}%"
            where.append(
                or_(
                    AdminAccount.email.ilike(pattern),
                    AdminAccount.name.ilike(pattern),
                )
            )
        return await self._page(
            where=where,
            order_by="created_at",
            descending=True,
            page=page,
            size=size,
        )


class AdminAccountInvitationRepository(PostgresRepository[AdminAccountInvitation]):
    model = AdminAccountInvitation

    # #
    # command

    @typecheck
    async def add(
        self,
        email: str,
        name: str,
        role: str,
        invited_by: uuid_str,
        expires_at: utc_dt,
        token: str = "",
    ) -> AdminAccountInvitation:
        return await super().add(
            AdminAccountInvitation(
                email=email,
                name=name,
                role=role,
                invited_by=invited_by,
                expires_at=expires_at,
                token=token,
            )
        )

    @typecheck
    async def update_invitation(
        self,
        id: uuid_str,
        name: str,
        role: str,
        invited_by: uuid_str,
        expires_at: utc_dt,
        token: str,
    ) -> AdminAccountInvitation | None:
        return await self.update_fields(
            id,
            name=name,
            role=role,
            invited_by=invited_by,
            expires_at=expires_at,
            token=token,
        )

    @typecheck
    async def update_token(self, id: uuid_str, *, token: str) -> AdminAccountInvitation | None:
        return await self.update_fields(id, token=token)

    @typecheck
    async def update_accepted(self, id: uuid_str, *, accepted_at: utc_dt) -> AdminAccountInvitation | None:
        return await self.update_fields(id, accepted_at=accepted_at)

    # #
    # query

    @typecheck
    async def find_pending_by_email(self, email: str) -> AdminAccountInvitation | None:
        now = utc_now()
        return await self._find(
            where=[
                AdminAccountInvitation.email == email,
                AdminAccountInvitation.accepted_at.is_(None),
                AdminAccountInvitation.expires_at > now,
            ],
            order_by="created_at",
            descending=True,
        )

