from datetime import datetime

from pydantic import BaseModel, Field

from ..send_link.schemas import SendChannel, SendLinkRecipient, DeliveryResult


class SendResultRecipient(SendLinkRecipient):
    pass


class SendResultCreate(BaseModel):
    recipients: list[SendResultRecipient] = Field(min_length=1)
    expires_at: datetime | None = None
    channel: SendChannel = Field(
        default=SendChannel.alarmtalk,
        description="발송 채널 (alarmtalk | sms)",
    )
    template_id: str | None = Field(
        default=None,
        description="문자 양식 ID (미지정 시 기본 양식 사용)",
    )


class SendResultResponse(BaseModel):
    id: str
    center_id: str
    case_id: str
    verification_code: str
    recipients: list[SendResultRecipient]
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    url: str
    channel: SendChannel
    delivery_results: list[DeliveryResult] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SendResultSummary(BaseModel):
    id: str
    verification_code: str
    recipients: list[SendResultRecipient]
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    channel: SendChannel | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SendResultResendRequest(BaseModel):
    failed_only: bool = Field(
        default=False,
        description="True이면 실패 수신자에게만 재전송",
    )


class VerifyRequest(BaseModel):
    verification_code: str = Field(
        min_length=4,
        max_length=4,
        description="4자리 인증 코드",
    )


class ReportDownload(BaseModel):
    assessment_name: str
    download_url: str
    expires_in: int = Field(
        default=3600,
        description="URL 유효 시간 (초)",
    )


class PendingAssessment(BaseModel):
    assessment_name: str
    status: str = Field(description="검사 상태 (pending, in_progress, submitted 등)")


class VerifyResponse(BaseModel):
    reports: list[ReportDownload]
    pending: list[PendingAssessment] = Field(
        default=[],
        description="미완료 검사 목록 (결과 확인 불가)",
    )
