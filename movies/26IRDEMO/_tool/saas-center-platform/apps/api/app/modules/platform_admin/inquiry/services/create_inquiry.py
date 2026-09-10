from ..events import InquiryAtomic
from ..models import Inquiry, InquiryType
from ..repository import InquiryRepository


class CreateInquiryService:
    def __init__(self, repo: InquiryRepository):
        self.repo = repo

    async def execute(
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
        # mutate
        inquiry = await self.repo.add(
            inquiry_type=inquiry_type,
            subject=subject,
            content=content,
            sender_name=sender_name,
            sender_email=sender_email,
            center_id=center_id,
            center_name=center_name,
        )
        return InquiryAtomic.created(inquiry=inquiry)
