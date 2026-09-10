from app.infrastructure.persistence.unit_of_work import UnitOfWork

from .events import InquiryAtomic
from .models import Inquiry, InquiryStatus, InquiryType
from .repository import InquiryRepository
from .services.create_inquiry import CreateInquiryService


class InquiryFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def create_inquiry(
        self,
        *,
        inquiry_type: InquiryType,
        subject: str,
        content: str,
        sender_name: str,
        sender_email: str,
        center_id: str | None,
        center_name: str | None,
    ) -> tuple[InquiryAtomic, Inquiry]:
        return await CreateInquiryService(self._uow.repo(InquiryRepository)).execute(
            inquiry_type=inquiry_type,
            subject=subject,
            content=content,
            sender_name=sender_name,
            sender_email=sender_email,
            center_id=center_id,
            center_name=center_name,
        )

    async def get_inquiry(
        self,
        inquiry_id: str,
    ) -> Inquiry:
        return await self._uow.repo(InquiryRepository).get_by_id(inquiry_id)

    async def answer_inquiry(
        self,
        inquiry_id: str,
        *,
        answer: str,
        answered_by: str,
        answered_at,
        status: InquiryStatus,
    ) -> Inquiry:
        return await self._uow.repo(InquiryRepository).update_in_place(
            id=inquiry_id,
            answer=answer,
            answered_by=answered_by,
            answered_at=answered_at,
            status=status,
        )

    async def list_by_sender_email_with_page(
        self,
        *,
        sender_email: str,
        center_id: str | None = None,
        page: int = 1,
        size: int = 20,
    ):
        return await self._uow.repo(InquiryRepository).list_by_sender_email_with_page(
            sender_email=sender_email, center_id=center_id, page=page, size=size
        )
