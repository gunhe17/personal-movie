from pydantic import BaseModel, EmailStr

from app.modules.platform_admin.qna.schemas import (
    FAQDetailResponse,
    FAQListResponse,
    InquiryDetailResponse,
    InquiryType,
)


class InquiryCreate(BaseModel):
    inquiry_type: InquiryType = InquiryType.GENERAL
    subject: str
    content: str
    sender_name: str
    sender_email: EmailStr
    center_id: str | None = None
    center_name: str | None = None


class InquiryResponse(BaseModel):
    success: bool
    message: str


class InquiryListResponse(BaseModel):
    items: list[InquiryDetailResponse]
    total: int
    page: int
    size: int
    pages: int


class PublicFAQItem(FAQDetailResponse):
    pass


class PublicFAQListResponse(FAQListResponse):
    items: list[PublicFAQItem]  # type: ignore[assignment]
