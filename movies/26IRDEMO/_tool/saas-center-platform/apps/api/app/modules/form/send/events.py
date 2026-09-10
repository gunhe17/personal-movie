from dataclasses import dataclass

from app.core.type import uuid_str

from .models import FormSend


@dataclass(frozen=True, kw_only=True)
class FormSendAtomic:
    _act: str
    form_send: FormSend
    _recipient_count: int | None = None

    @classmethod
    def created(
        cls,
        *,
        form_send: FormSend,
    ) -> tuple["FormSendAtomic", FormSend]:
        return cls(_act="created", form_send=form_send), form_send

    @classmethod
    def resent(
        cls,
        *,
        form_send: FormSend,
        recipient_count: int,
    ) -> tuple["FormSendAtomic", FormSend]:
        return cls(_act="resent", form_send=form_send, _recipient_count=recipient_count), form_send

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "form_send"

    def act_entity_id(self) -> uuid_str:
        return self.form_send.id

    def payload(self) -> dict:
        # 수신자 평문(전화번호)은 audit(event_atomics)에 싣지 않는다 — 건수만.
        # resent는 재발송 대상 건수(failed_only면 원본보다 적을 수 있음)를 담는다.
        count = (
            self._recipient_count
            if self._recipient_count is not None
            else len(self.form_send.recipients or [])
        )
        return {
            "data": {
                "id": self.form_send.id,
                "form_template_id": self.form_send.form_template_id,
                "channel": self.form_send.channel,
                "recipient_count": count,
            }
        }
