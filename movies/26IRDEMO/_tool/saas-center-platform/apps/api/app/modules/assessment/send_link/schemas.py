from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class SendChannel(str, Enum):
    alarmtalk = "alarmtalk"
    sms = "sms"


class SendLinkRecipient(BaseModel):
    name: str
    phone: str
    relation: str | None = None


class DeliveryResult(BaseModel):
    recipient_phone: str
    recipient_name: str
    status: str  # "sent" | "failed"
    message_id: str | None = None
    error: str | None = None


class SendLinkCreate(BaseModel):
    template_id: str | None = Field(default=None, min_length=1, max_length=36)
    recipients: list[SendLinkRecipient] = Field(min_length=1)
    expires_at: datetime | None = None
    assessment_ids: list[str] = Field(min_length=1)
    channel: SendChannel = Field(
        default=SendChannel.alarmtalk,
        description="발송 채널 (alarmtalk | sms)",
    )


class SendLinkResponse(BaseModel):
    id: str
    center_id: str
    case_id: str
    verification_code: str
    recipients: list[SendLinkRecipient]
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    assessment_ids: list[str]
    url: str
    channel: SendChannel
    delivery_results: list[DeliveryResult] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SendLinkSummary(BaseModel):
    id: str
    verification_code: str
    recipients: list[SendLinkRecipient]
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    assessment_ids: list[str]
    channel: SendChannel | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SendLinkResendRequest(BaseModel):
    template_id: str | None = Field(default=None, min_length=1, max_length=36)
    failed_only: bool = Field(
        default=False,
        description="True이면 실패 수신자에게만 재전송",
    )


class BulkSendLinkCreate(BaseModel):
    template_id: str | None = Field(default=None, min_length=1, max_length=36)
    case_ids: list[str] = Field(min_length=1, description="대상 케이스 ID 목록")
    recipients: list[SendLinkRecipient] = Field(min_length=1)
    expires_at: datetime | None = None
    assessment_ids: list[str] = Field(min_length=1)
    channel: SendChannel = Field(
        default=SendChannel.alarmtalk,
        description="발송 채널 (alarmtalk | sms)",
    )


class BulkSendLinkResult(BaseModel):
    case_id: str
    send_link_id: str | None = None
    status: str  # "success" | "failed"
    error: str | None = None
    delivery_results: list[DeliveryResult] = []


class BulkSendLinkResponse(BaseModel):
    total: int
    success_count: int
    fail_count: int
    results: list[BulkSendLinkResult]


class LinkVerifyRequest(BaseModel):
    verification_code: str


class LinkTaskItem(BaseModel):
    task_id: str
    assessment_id: str
    assessment_name: str
    status: str
    execution_method: str = "online"
    schedule_id: str | None = None
    report_available: bool = False


class LinkScheduleItem(BaseModel):
    schedule_id: str
    start: datetime
    end: datetime
    status: str
    assessment_names: list[str]


class LinkJournalItem(BaseModel):
    """바로링크로 보이는 상담 기록 한 편.

    **발행된 공유문만** 나간다 — 임상 원문(counseling_notes)은 여기 절대 실리지 않는다.
    앱(client_app)이 보는 것과 같은 집합이고, 게이트만 다르다(앱은 가족-센터 연결,
    여기는 링크 인증). 그래서 필드도 앱의 AppSessionShareItem과 같은 둘이다.
    """

    session_id: str
    session_no: int | None = None
    text: str | None = None
    published_at: datetime | None = None


class LinkVerifyResponse(BaseModel):
    access_token: str
    center_id: str
    center_name: str
    case_id: str
    recipient_name: str | None = None
    tasks: list[LinkTaskItem]
    schedules: list[LinkScheduleItem] = Field(default_factory=list)
    journals: list[LinkJournalItem] = Field(default_factory=list)
