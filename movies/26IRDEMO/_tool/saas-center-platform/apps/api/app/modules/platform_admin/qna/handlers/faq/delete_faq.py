from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.faq.repository import FAQRepository
from app.modules.platform_admin.faq.services.delete_faq import DeleteFAQService


async def delete_faq_handler(
    *,
    faq_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> dict:
    service = DeleteFAQService(uow.repo(FAQRepository))
    atomic, question = await service.execute(faq_id=faq_id)

    await emit(
        uow,
        "faq_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return {"detail": "삭제되었습니다"}


TOOL = {
    "name": "delete_faq_handler",
    "permission": None,
    "purpose": "FAQ를 삭제한다.",
    "keywords": ["FAQ 삭제", "자주 묻는 질문 삭제", "faq 삭제"],
    "boundaries": "운영자 전용 — FAQ 단건 삭제. 조회는 get_faq_handler.",
    "output": "삭제 결과 메시지 (dict).",
    "input_schema": {
        "type": "object",
        "properties": {
            "faq_id": {'type': 'string', 'format': 'uuid', 'title': '대상 FAQ', 'description': '삭제할 FAQ의 UUID.'},
        },
        "required": ["faq_id"],
    },
}
