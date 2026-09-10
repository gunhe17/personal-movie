from datetime import datetime, timedelta

from app.core.datetime_utils import utc_now
from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import LoginNotification


class LoginNotificationRepository(PostgresRepository[LoginNotification]):
    model = LoginNotification

    # #
    # command

    @typecheck
    async def add(
        self,
        account_id: uuid_str,
        ip_address: str,
        login_at: utc_dt,
        device_info: str | None = None,
        location: str | None = None,
        is_new_device: bool = False,
    ) -> LoginNotification:
        return await super().add(
            LoginNotification(
                account_id=account_id,
                ip_address=ip_address,
                login_at=login_at,
                device_info=device_info,
                location=location,
                is_new_device=is_new_device,
            )
        )

    @typecheck
    async def update_notified(
        self,
        notification_id: str,
        notified_at: datetime | None = None,
    ) -> LoginNotification | None:
        return await self.update_fields(
            notification_id, notified_at=notified_at or utc_now()
        )

    # #
    # query

    @typecheck
    async def list_recent_by_account(
        self,
        account_id: str,
        days: int = 30,
        limit: int = 10,
    ) -> list[LoginNotification]:
        cutoff = utc_now() - timedelta(days=days)
        return await self._filter(
            where=[
                LoginNotification.account_id == account_id,
                LoginNotification.login_at >= cutoff,
            ],
            order_by="login_at",
            descending=True,
            limit=limit,
        )

    @typecheck
    async def exists_device(
        self,
        account_id: str,
        device_info: str | None,
        days: int = 90,
    ) -> bool:
        if not device_info:
            return False
        cutoff = utc_now() - timedelta(days=days)
        return (
            await self._count(
                where=[
                    LoginNotification.account_id == account_id,
                    LoginNotification.device_info == device_info,
                    LoginNotification.login_at >= cutoff,
                ]
            )
            > 0
        )
