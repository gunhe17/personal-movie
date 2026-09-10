from dataclasses import dataclass

from app.core.type import uuid_str

from .models import LoginNotification


@dataclass(frozen=True, kw_only=True)
class LoginNotificationAtomic:
    notification: LoginNotification
    _act: str = "created"

    @classmethod
    def new_device(
        cls,
        *,
        notification: LoginNotification,
    ) -> "LoginNotificationAtomic":
        return cls(notification=notification)

    @classmethod
    def notified(
        cls,
        *,
        notification: LoginNotification,
    ) -> tuple["LoginNotificationAtomic", LoginNotification]:
        return cls(notification=notification, _act="notified"), notification

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "login_notification"

    def act_entity_id(self) -> uuid_str:
        return self.notification.id

    def payload(self) -> dict:
        # 이메일 본문 데이터는 reaction이 재조회 — id만 싣는다
        return {
            "data": {
                "id": self.notification.id,
                "account_id": self.notification.account_id,
            }
        }
