from app.core.schemas import DetailResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.notice.facade import NoticeFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def delete_admin_notice_handler(
    *,
    notice_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> DetailResponse:
    title = await NoticeFacade(uow).delete_notice(notice_id)

    await emit(
        uow,
        "notice_deleted",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="deleted",
            _entity_name="notice",
            _entity_id=notice_id,
            _payload={"data": {"id": notice_id, "title": title}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return DetailResponse(detail="삭제되었습니다")


TOOL = {
    "name": "delete_admin_notice_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "운영자가 공지를 삭제한다.",
    "keywords": ["공지 삭제", "공지사항 삭제", "admin notice 삭제"],
    "boundaries": "운영자 전용 — 공지 삭제. 조회는 get_admin_notice_handler.",
    "output": "삭제 결과 메시지 (DetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "notice_id": {'type': 'string', 'format': 'uuid', 'title': '대상 공지', 'description': '삭제할 공지의 UUID.'},
        },
        "required": ["notice_id"],
    },
}
