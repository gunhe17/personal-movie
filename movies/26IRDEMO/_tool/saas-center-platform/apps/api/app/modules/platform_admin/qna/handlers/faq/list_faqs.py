from sqlalchemy import select, func, or_

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.faq.models import FAQ
from app.modules.platform_admin.qna.schemas import FAQSummary, FAQListResponse


async def list_faqs_handler(
    uow: UnitOfWork,
    *,
    category: str | None = None,
    is_published: bool | None = None,
    search: str | None = None,
    page: int = 1,
    size: int = 20,
) -> FAQListResponse:
    session = uow.session

    conditions = [FAQ.deleted_at.is_(None)]

    if category:
        conditions.append(FAQ.category == category)

    if is_published is not None:
        conditions.append(FAQ.is_published == is_published)

    if search:
        conditions.append(
            or_(
                FAQ.question.ilike(f"%{search}%"),
                FAQ.answer.ilike(f"%{search}%"),
            )
        )

    count_stmt = select(func.count()).select_from(FAQ).where(*conditions)
    total = (await session.execute(count_stmt)).scalar_one()

    offset = (page - 1) * size
    stmt = (
        select(FAQ)
        .where(*conditions)
        .order_by(FAQ.category.asc(), FAQ.sort_order.asc())
        .offset(offset)
        .limit(size)
    )
    rows = (await session.execute(stmt)).scalars().all()
    items = [FAQSummary.model_validate(row) for row in rows]

    return FAQListResponse.build(items=items, total=total, page=page, size=size)


TOOL = {
    "name": "list_faqs_handler",
    "permission": None,
    "purpose": "FAQ 목록을 분류·게시여부·검색으로 조회한다.",
    "keywords": ["FAQ 목록", "자주 묻는 질문 조회", "faq 리스트"],
    "boundaries": "운영자 전용 — FAQ 목록(읽기). 단건은 get_faq_handler.",
    "output": "FAQ 목록 (FAQListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "title": "분류 필터",
                "description": "분류 필터(getting_started/general/technical/feature, 선택).",
            },
            "is_published": {
                "type": "boolean",
                "title": "게시 여부 필터",
                "description": "게시 여부 필터(선택).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "질문·답변 검색어(선택).",
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
