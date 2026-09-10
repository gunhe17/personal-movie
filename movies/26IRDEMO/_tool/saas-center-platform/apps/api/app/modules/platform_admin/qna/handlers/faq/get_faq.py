from sqlalchemy import select

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.faq.models import FAQ
from app.modules.platform_admin.qna.schemas import FAQDetailResponse


async def get_faq_handler(
    faq_id: str,
    uow: UnitOfWork,
) -> FAQDetailResponse:
    session = uow.session

    stmt = select(FAQ).where(
        FAQ.id == faq_id,
        FAQ.deleted_at.is_(None),
    )
    faq = (await session.execute(stmt)).scalar_one_or_none()

    if not faq:
        raise EntityNotFoundException(f"FAQ를 찾을 수 없습니다: {faq_id}")

    return FAQDetailResponse.model_validate(faq)


TOOL = {
    "name": "get_faq_handler",
    "permission": None,
    "purpose": "FAQ 한 건을 조회한다.",
    "keywords": ["FAQ 조회", "자주 묻는 질문 상세", "faq 상세"],
    "boundaries": "운영자 전용 — FAQ 단건 조회(읽기). 목록은 list_faqs_handler.",
    "output": "FAQ 상세 (FAQDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "faq_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 FAQ",
                "description": "조회할 FAQ의 UUID.",
            },
        },
        "required": ["faq_id"],
    },
}
