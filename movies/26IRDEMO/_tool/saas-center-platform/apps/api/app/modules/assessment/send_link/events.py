from dataclasses import dataclass

from app.core.type import uuid_str

from .models import AssessmentSendLink


@dataclass(frozen=True, kw_only=True)
class SendLinkAtomic:
    _act: str
    send_link: AssessmentSendLink
    _recipient_count: int | None = None

    @classmethod
    def created(
        cls,
        *,
        send_link: AssessmentSendLink,
    ) -> tuple["SendLinkAtomic", AssessmentSendLink]:
        return cls(_act="created", send_link=send_link), send_link

    @classmethod
    def resent(
        cls,
        *,
        send_link: AssessmentSendLink,
        recipient_count: int,
    ) -> tuple["SendLinkAtomic", AssessmentSendLink]:
        return cls(_act="resent", send_link=send_link, _recipient_count=recipient_count), send_link

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "assessment_send_link"

    def act_entity_id(self) -> uuid_str:
        return self.send_link.id

    def payload(self) -> dict:
        # 전화번호·인증코드 평문은 audit에 싣지 않는다 — 건수·채널만.
        count = (
            self._recipient_count
            if self._recipient_count is not None
            else len(self.send_link.recipients or [])
        )
        return {
            "data": {
                "id": self.send_link.id,
                "case_id": self.send_link.case_id,
                "channel": self.send_link.channel,
                "recipient_count": count,
            }
        }
