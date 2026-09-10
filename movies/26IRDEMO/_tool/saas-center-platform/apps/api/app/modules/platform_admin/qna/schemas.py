import math
from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.platform_admin.inquiry.models import InquiryStatus, InquiryType
from app.modules.platform_admin.faq.models import FAQCategory


# ── Inquiry 요청 스키마 ──

class InquiryAnswerRequest(BaseModel):
    answer: str = Field(..., min_length=1, description="답변 내용")


class InquiryStatusRequest(BaseModel):
    status: InquiryStatus = Field(..., description="변경할 상태")


# ── Inquiry 응답 스키마 ──

class InquirySummary(BaseModel):
    id: str
    center_name: str | None = None
    inquiry_type: InquiryType
    status: InquiryStatus
    subject: str
    sender_name: str
    sender_email: str
    answered_by_name: str | None = None
    answered_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class InquiryDetailResponse(BaseModel):
    id: str
    center_id: str | None = None
    center_name: str | None = None
    inquiry_type: InquiryType
    status: InquiryStatus
    subject: str
    content: str
    sender_name: str
    sender_email: str
    answered_by: str | None = None
    answered_by_name: str | None = None
    answer: str | None = None
    answered_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InquiryListResponse(BaseModel):
    items: list[InquirySummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(cls, items: list[InquirySummary], total: int, page: int, size: int) -> "InquiryListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


# ── FAQ 요청 스키마 ──

class FAQCreate(BaseModel):
    category: FAQCategory = Field(..., description="카테고리")
    question: str = Field(..., max_length=500, description="질문")
    answer: str = Field(..., min_length=1, description="답변")
    is_published: bool = Field(default=False, description="즉시 게시 여부")


class FAQUpdate(BaseModel):
    category: FAQCategory | None = Field(default=None)
    question: str | None = Field(default=None, max_length=500)
    answer: str | None = Field(default=None, min_length=1)
    is_published: bool | None = Field(default=None)


class FAQReorderRequest(BaseModel):
    category: FAQCategory = Field(..., description="카테고리")
    faq_ids: list[str] = Field(..., description="순서대로 정렬된 FAQ ID 목록")


# ── FAQ 응답 스키마 ──

class FAQSummary(BaseModel):
    id: str
    category: FAQCategory
    question: str
    is_published: bool
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class FAQDetailResponse(BaseModel):
    id: str
    category: FAQCategory
    question: str
    answer: str
    is_published: bool
    sort_order: int
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FAQListResponse(BaseModel):
    items: list[FAQSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(cls, items: list[FAQSummary], total: int, page: int, size: int) -> "FAQListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )
