from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Notification
from .schemas import NotificationResponse


@dataclass(frozen=True, kw_only=True)
class NotificationAtomic:
    _act: str
    notification: Notification

    @classmethod
    def created(
        cls, *, notification: Notification
    ) -> tuple["NotificationAtomic", Notification]:
        return cls(_act="created", notification=notification), notification

    @classmethod
    def read(
        cls, *, notification: Notification
    ) -> tuple["NotificationAtomic", Notification]:
        return cls(_act="read", notification=notification), notification

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "notification"

    def act_entity_id(self) -> uuid_str:
        return self.notification.id

    def payload(self) -> dict:
        dump = NotificationResponse.model_validate(self.notification).model_dump(
            mode="json"
        )
        return {"data": dump}
