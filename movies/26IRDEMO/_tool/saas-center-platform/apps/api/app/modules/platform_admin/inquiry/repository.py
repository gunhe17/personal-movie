from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck

from app.infrastructure.persistence.new_repository import PostgresRepository
from .models import Inquiry, InquiryStatus, InquiryType


class InquiryRepository(PostgresRepository[Inquiry]):
    model = Inquiry

    # #
    # command

    @typecheck
    async def add(
        self,
        *,
        inquiry_type: InquiryType,
        subject: str,
        content: str,
        sender_name: str,
        sender_email: str,
        center_id: str | None,
        center_name: str | None,
    ) -> Inquiry:
        return await super().add(
            Inquiry(
                inquiry_type=inquiry_type,
                status=InquiryStatus.PENDING,
                subject=subject,
                content=content,
                sender_name=sender_name,
                sender_email=sender_email,
                center_id=center_id,
                center_name=center_name,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        answer: str = unset,
        answered_by: str | None = unset,
        answered_at: utc_dt | None = unset,
        status: InquiryStatus = unset,
    ) -> Inquiry:
        await self.get_by_id(id)
        updated = await self.update_fields(
            id,
            answer=answer,
            answered_by=answered_by,
            answered_at=answered_at,
            status=status,
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def get_by_id(self, id: uuid_str) -> Inquiry:
        inquiry = await self.find_by_id(id)
        if inquiry is None:
            raise EntityNotFoundException(f"문의를 찾을 수 없습니다: {id}")
        return inquiry

    @typecheck
    async def list_by_sender_email_with_page(
        self,
        *,
        sender_email: str,
        center_id: str | None = None,
        page: int = 1,
        size: int = 20,
    ):
        where = [Inquiry.sender_email == sender_email]
        if center_id:
            where.append(Inquiry.center_id == center_id)
        else:
            where.append(Inquiry.center_id.is_(None))

        return await self._page(
            where=where,
            order_by="created_at",
            descending=True,
            page=page,
            size=size,
        )
