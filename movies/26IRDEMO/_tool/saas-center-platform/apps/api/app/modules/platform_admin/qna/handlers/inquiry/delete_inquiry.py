from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.inquiry.repository import InquiryRepository
from app.modules.platform_admin.inquiry.services.delete_inquiry import DeleteInquiryService


async def delete_inquiry_handler(
    *,
    inquiry_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> dict:
    service = DeleteInquiryService(uow.repo(InquiryRepository))
    atomic, subject = await service.execute(inquiry_id=inquiry_id)

    await emit(
        uow,
        "inquiry_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return {"detail": "삭제되었습니다"}


TOOL = {
    "name": "delete_inquiry_handler",
    "permission": None,
    "purpose": "문의를 삭제한다.",
    "keywords": ["문의 삭제", "1:1 문의 삭제", "inquiry 삭제"],
    "boundaries": "운영자 전용 — 문의 단건 삭제. 조회는 get_inquiry_handler.",
    "output": "삭제 결과 메시지 (dict).",
    "input_schema": {
        "type": "object",
        "properties": {
            "inquiry_id": {'type': 'string', 'format': 'uuid', 'title': '대상 문의', 'description': '삭제할 문의의 UUID.'},
        },
        "required": ["inquiry_id"],
    },
}
