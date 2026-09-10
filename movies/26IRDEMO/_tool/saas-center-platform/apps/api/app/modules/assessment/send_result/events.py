from dataclasses import dataclass

from app.core.type import uuid_str

from .models import AssessmentSendResult


@dataclass(frozen=True, kw_only=True)
class SendResultAtomic:
    _act: str
    send_result: AssessmentSendResult
    _recipient_count: int | None = None

    @classmethod
    def created(
        cls,
        *,
        send_result: AssessmentSendResult,
    ) -> tuple["SendResultAtomic", AssessmentSendResult]:
        return cls(_act="created", send_result=send_result), send_result

    @classmethod
    def resent(
        cls,
        *,
        send_result: AssessmentSendResult,
        recipient_count: int,
    ) -> tuple["SendResultAtomic", AssessmentSendResult]:
        return cls(_act="resent", send_result=send_result, _recipient_count=recipient_count), send_result

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "assessment_send_result"

    def act_entity_id(self) -> uuid_str:
        return self.send_result.id

    def payload(self) -> dict:
        count = (
            self._recipient_count
            if self._recipient_count is not None
            else len(self.send_result.recipients or [])
        )
        return {
            "data": {
                "id": self.send_result.id,
                "case_id": self.send_result.case_id,
                "channel": self.send_result.channel,
                "recipient_count": count,
            }
        }


@dataclass(frozen=True, kw_only=True)
class SendResultAccessAtomic:
    # 공개 수신자(guest)의 결과 인증 접근 — 민감 보고서 접근·실패시도 감사.
    # 엔티티를 안 돌려받는 verify 경로라 send_result_id + 최소 data만 싣는다.
    _act: str
    _send_result_id: str
    _data: dict

    @classmethod
    def verified(
        cls,
        *,
        send_result_id: str,
        completed_count: int,
        pending_count: int,
    ) -> "SendResultAccessAtomic":
        return cls(
            _act="verified",
            _send_result_id=send_result_id,
            _data={"completed": completed_count, "pending": pending_count},
        )

    @classmethod
    def verification_failed(
        cls,
        *,
        send_result_id: str,
    ) -> "SendResultAccessAtomic":
        return cls(_act="verification_failed", _send_result_id=send_result_id, _data={})

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "assessment_send_result"

    def act_entity_id(self) -> uuid_str:
        return self._send_result_id

    def payload(self) -> dict:
        return {"data": self._data}
