from datetime import datetime

from app.core.datetime_utils import utc_now

from ..events import LoginNotificationAtomic
from ..models import LoginNotification
from ..repository import LoginNotificationRepository


class CreateLoginNotificationService:
    def __init__(self, repo: LoginNotificationRepository):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        device_info: str | None,
        ip_address: str,
        location: str | None = None,
        login_at: datetime | None = None,
    ) -> tuple[LoginNotificationAtomic | None, LoginNotification]:
        # detect
        is_new_device = not await self.repo.exists_device(
            account_id=account_id,
            device_info=device_info,
            days=90,
        )

        # create
        notification = await self.repo.add(
            account_id=account_id,
            ip_address=ip_address,
            login_at=login_at or utc_now(),
            device_info=device_info,
            location=location,
            is_new_device=is_new_device,
        )

        # return (새 기기일 때만 atomic — 기존 기기는 None)
        atomic = LoginNotificationAtomic.new_device(notification=notification) if is_new_device else None
        return atomic, notification
