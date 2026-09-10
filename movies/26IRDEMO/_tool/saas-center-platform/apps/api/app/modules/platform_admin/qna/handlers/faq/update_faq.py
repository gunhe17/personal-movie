from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.type import unset
from app.modules.event import emit
from app.modules.platform_admin.faq.repository import FAQRepository
from app.modules.platform_admin.faq.services.update_faq import UpdateFAQService
from app.modules.platform_admin.qna.schemas import FAQUpdate, FAQDetailResponse


async def update_faq_handler(
    *,
    faq_id: str,
    data: FAQUpdate,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> FAQDetailResponse:
    update_data = data.model_dump(exclude_unset=True)
    category = update_data["category"].value if update_data.get("category") is not None else unset

    service = UpdateFAQService(uow.repo(FAQRepository))
    atomic, faq = await service.execute(
        faq_id,
        category=category,
        question=update_data.get("question", unset),
        answer=update_data.get("answer", unset),
        is_published=update_data.get("is_published", unset),
        sort_order=update_data.get("sort_order", unset),
    )

    await emit(
        uow,
        "faq_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return FAQDetailResponse.model_validate(faq)


TOOL = {
    "name": "update_faq_handler",
    "permission": None,
    "purpose": "FAQ 내용을 수정한다.",
    "keywords": ["FAQ 수정", "자주 묻는 질문 편집", "faq 변경"],
    "boundaries": "운영자 전용 — FAQ 수정. 생성은 create_faq_handler, 순서 변경은 reorder_faqs_handler.",
    "output": "수정된 FAQ 상세 (FAQDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "faq_id": {'type': 'string', 'format': 'uuid', 'title': '대상 FAQ', 'description': '수정할 FAQ의 UUID.'},
            "category": {'anyOf': [{'$ref': '#/$defs/FAQCategory'}, {'type': 'null'}], 'default': None, 'description': '분류(미지정 시 유지).'},
            "question": {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '질문', 'description': '질문(미지정 시 유지).'},
            "answer": {'anyOf': [{'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '답변', 'description': '답변(미지정 시 유지).'},
            "is_published": {'anyOf': [{'type': 'boolean'}, {'type': 'null'}], 'default': None, 'title': '게시 여부', 'description': '게시 여부(미지정 시 유지).'},
        },
        "$defs": {'FAQCategory': {'enum': ['getting_started', 'general', 'technical', 'feature'], 'title': 'FAQCategory', 'type': 'string'}},
        "required": ["faq_id"],
    },
}
