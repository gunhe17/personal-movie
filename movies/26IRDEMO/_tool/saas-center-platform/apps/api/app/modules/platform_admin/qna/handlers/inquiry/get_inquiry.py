from sqlalchemy import select

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.inquiry.models import Inquiry
from app.modules.platform_admin.qna.schemas import InquiryDetailResponse


async def get_inquiry_handler(
    inquiry_id: str,
    uow: UnitOfWork,
) -> InquiryDetailResponse:
    session = uow.session

    stmt = select(Inquiry).where(
        Inquiry.id == inquiry_id,
        Inquiry.deleted_at.is_(None),
    )
    inquiry = (await session.execute(stmt)).scalar_one_or_none()

    if not inquiry:
        raise EntityNotFoundException(f"문의를 찾을 수 없습니다: {inquiry_id}")

    response = InquiryDetailResponse.model_validate(inquiry)
    if inquiry.answered_by:
        names = await uow.repo(AdminAccountRepository).aggregate_name_map_by_ids(
            ids=[inquiry.answered_by]
        )
        response.answered_by_name = names.get(inquiry.answered_by)
    return response


TOOL = {
    "name": "get_inquiry_handler",
    "permission": None,
    "purpose": "문의 한 건을 조회한다.",
    "keywords": ["문의 조회", "1:1 문의 상세", "inquiry 상세"],
    "boundaries": "운영자 전용 — 문의 단건 조회(읽기). 목록은 list_inquiries_handler.",
    "output": "문의 상세 (InquiryDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "inquiry_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 문의",
                "description": "조회할 문의의 UUID.",
            },
        },
        "required": ["inquiry_id"],
    },
}
