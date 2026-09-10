from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.faq.repository import FAQRepository
from app.modules.platform_admin.faq.services.reorder_faqs import ReorderFAQsService
from app.modules.platform_admin.qna.schemas import FAQReorderRequest


async def reorder_faqs_handler(
    *,
    data: FAQReorderRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> dict:
    service = ReorderFAQsService(uow.repo(FAQRepository))
    atomic, _count = await service.execute(
        category=data.category.value,
        faq_ids=data.faq_ids,
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

    return {"detail": "순서가 저장되었습니다"}


TOOL = {
    "name": "reorder_faqs_handler",
    "permission": None,
    "purpose": "한 분류 내 FAQ 노출 순서를 재정렬한다.",
    "keywords": ["FAQ 순서 변경", "자주 묻는 질문 정렬", "faq reorder"],
    "boundaries": "운영자 전용 — 같은 분류의 FAQ 순서 일괄 변경. 개별 수정은 update_faq_handler.",
    "output": "재정렬 결과 메시지 (dict).",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {'$ref': '#/$defs/FAQCategory', 'description': '재정렬할 분류.'},
            "faq_ids": {'type': 'array', 'items': {'type': 'string', 'format': 'uuid'}, 'title': '정렬된 FAQ 목록', 'description': '원하는 노출 순서대로 나열한 FAQ ID 목록.'},
        },
        "$defs": {'FAQCategory': {'enum': ['getting_started', 'general', 'technical', 'feature'], 'title': 'FAQCategory', 'type': 'string'}},
        "required": ["category", "faq_ids"],
    },
}
