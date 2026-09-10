from datetime import datetime
from typing import Any
from enum import Enum

from pydantic import BaseModel, Field


class SendChannel(str, Enum):
    alarmtalk = "alarmtalk"
    sms = "sms"


class FormSendRecipient(BaseModel):
    name: str
    phone: str
    relation: str | None = None
    # 발급된 폼 인스턴스 (수신자별 1건) — 작성 여부 추적용
    instance_id: str | None = None
    # 인스턴스 상태 (draft | submitted). 저장값이 아니라 조회 시 enrich
    status: str | None = None


class DeliveryResult(BaseModel):
    recipient_phone: str
    recipient_name: str
    status: str  # "sent" | "failed"
    message_id: str | None = None
    error: str | None = None


class FormSendCreate(BaseModel):
    recipients: list[FormSendRecipient] = Field(min_length=1)
    channel: SendChannel = Field(
        default=SendChannel.sms,
        description="발송 채널 (alarmtalk | sms)",
    )
    template_id: str | None = Field(
        default=None,
        description="문자 양식 ID (미지정 시 기본 양식 사용)",
    )


class FormSendResponse(BaseModel):
    id: str
    center_id: str
    form_template_id: str
    recipients: list[FormSendRecipient]
    channel: SendChannel
    delivery_results: list[DeliveryResult] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FormSendSummary(BaseModel):
    id: str
    recipients: list[FormSendRecipient]
    channel: SendChannel | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FormSendResendRequest(BaseModel):
    failed_only: bool = Field(
        default=False,
        description="True이면 실패 수신자에게만 재전송 (폼 전송은 발송 단위 이력만 보관하므로 현재 전체 재전송)",
    )


# 원격 작성 링크 (보호자용 게스트 표면)


class FormLinkVerifyRequest(BaseModel):
    verification_code: str = Field(..., min_length=4, max_length=4)


class FormLinkVerifyResponse(BaseModel):
    access_token: str
    center_name: str
    form_name: str
    status: str
    schema_: dict[str, Any] = Field(..., alias="schema")
    values: list[dict[str, Any]] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class _FormLinkValueItem(BaseModel):
    field_key: str = Field(..., max_length=100)
    group_index: int = Field(default=0, ge=0)
    value: dict[str, Any]


class FormLinkSubmitRequest(BaseModel):
    values: list[_FormLinkValueItem] = Field(default_factory=list)
