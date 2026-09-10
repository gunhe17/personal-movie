from sqlalchemy import select, func, or_

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.inquiry.models import Inquiry
from app.modules.platform_admin.qna.schemas import InquirySummary, InquiryListResponse


async def list_inquiries_handler(
    uow: UnitOfWork,
    *,
    inquiry_type: str | None = None,
    status: str | None = None,
    search: str | None = None,
    page: int = 1,
    size: int = 20,
) -> InquiryListResponse:
    session = uow.session

    conditions = [Inquiry.deleted_at.is_(None)]

    if inquiry_type:
        conditions.append(Inquiry.inquiry_type == inquiry_type)

    if status:
        conditions.append(Inquiry.status == status)

    if search:
        conditions.append(
            or_(
                Inquiry.subject.ilike(f"%{search}%"),
                Inquiry.content.ilike(f"%{search}%"),
                Inquiry.sender_name.ilike(f"%{search}%"),
            )
        )

    count_stmt = select(func.count()).select_from(Inquiry).where(*conditions)
    total = (await session.execute(count_stmt)).scalar_one()

    offset = (page - 1) * size
    stmt = (
        select(Inquiry)
        .where(*conditions)
        .order_by(Inquiry.created_at.desc())
        .offset(offset)
        .limit(size)
    )
    rows = (await session.execute(stmt)).scalars().all()
    items = [InquirySummary.model_validate(row) for row in rows]
    answerer_ids = [r.answered_by for r in rows if r.answered_by]
    names = await uow.repo(AdminAccountRepository).aggregate_name_map_by_ids(
        ids=answerer_ids
    )
    for item, row in zip(items, rows):
        if row.answered_by:
            item.answered_by_name = names.get(row.answered_by)

    return InquiryListResponse.build(items=items, total=total, page=page, size=size)


TOOL = {
    "name": "list_inquiries_handler",
    "permission": None,
    "purpose": "문의 목록을 유형·상태·검색으로 조회한다.",
    "keywords": ["문의 목록", "1:1 문의 조회", "inquiry 리스트"],
    "boundaries": "운영자 전용 — 문의 목록(읽기). 단건은 get_inquiry_handler.",
    "output": "문의 목록 (InquiryListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "inquiry_type": {
                "type": "string",
                "title": "유형 필터",
                "description": "문의 유형 필터(선택).",
            },
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "문의 상태 필터(pending/in_progress/resolved/closed, 선택).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "제목·내용 검색어(선택).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": [],
    },
}
