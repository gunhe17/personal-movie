from dataclasses import dataclass

from app.core.type import uuid_str

from .models import NotificationSetting


@dataclass(frozen=True, kw_only=True)
class NotificationSettingAtomic:
    _act: str
    setting: NotificationSetting
    _changed: dict | None = None

    @classmethod
    def created(
        cls,
        *,
        setting: NotificationSetting,
    ) -> tuple["NotificationSettingAtomic", NotificationSetting]:
        return cls(_act="created", setting=setting), setting

    @classmethod
    def updated(
        cls,
        *,
        setting: NotificationSetting,
        changed: dict,
    ) -> tuple["NotificationSettingAtomic", NotificationSetting]:
        return cls(_act="updated", setting=setting, _changed=changed), setting

    @classmethod
    def deleted(
        cls,
        *,
        setting: NotificationSetting,
    ) -> tuple["NotificationSettingAtomic", NotificationSetting]:
        return cls(_act="deleted", setting=setting), setting

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "notification_setting"

    def act_entity_id(self) -> uuid_str:
        return self.setting.id

    def payload(self) -> dict:
        dump = {
            "account_id": self.setting.account_id,
            "category": self.setting.category,
            "event_type": self.setting.event_type,
            "channel_in_app": self.setting.channel_in_app,
            "channel_push": self.setting.channel_push,
            "channel_alarmtalk": self.setting.channel_alarmtalk,
        }
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
