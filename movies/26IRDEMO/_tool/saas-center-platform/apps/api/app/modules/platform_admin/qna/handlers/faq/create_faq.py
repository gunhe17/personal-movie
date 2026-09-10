from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.faq.repository import FAQRepository
from app.modules.platform_admin.faq.services.create_faq import CreateFAQService
from app.modules.platform_admin.qna.schemas import FAQCreate, FAQDetailResponse


async def create_faq_handler(
    *,
    data: FAQCreate,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> FAQDetailResponse:
    service = CreateFAQService(uow.repo(FAQRepository))
    atomic, faq = await service.execute(
        category=data.category.value,
        question=data.question,
        answer=data.answer,
        is_published=data.is_published,
        actor_id=actor_id,
    )

    await emit(
        uow,
        "faq_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return FAQDetailResponse.model_validate(faq)


TOOL = {
    "name": "create_faq_handler",
    "permission": None,
    "purpose": "FAQ(자주 묻는 질문)를 작성한다.",
    "keywords": ["FAQ 작성", "자주 묻는 질문 등록", "faq 생성"],
    "boundaries": "운영자 전용 — FAQ 생성. 수정은 update_faq_handler, 순서 변경은 reorder_faqs_handler.",
    "output": "생성된 FAQ 상세 (FAQDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {'$ref': '#/$defs/FAQCategory', 'description': '분류: getting_started(시작하기)/general(일반)/technical(기술)/feature(기능).'},
            "question": {'type': 'string', 'maxLength': 500, 'title': '질문', 'description': 'FAQ 질문 내용.'},
            "answer": {'type': 'string', 'minLength': 1, 'title': '답변', 'description': 'FAQ 답변 내용.'},
            "is_published": {'type': 'boolean', 'default': False, 'title': '즉시 게시', 'description': 'true면 즉시 공개.'},
        },
        "$defs": {'FAQCategory': {'enum': ['getting_started', 'general', 'technical', 'feature'], 'title': 'FAQCategory', 'type': 'string'}},
        "required": ["category", "question", "answer"],
    },
}
