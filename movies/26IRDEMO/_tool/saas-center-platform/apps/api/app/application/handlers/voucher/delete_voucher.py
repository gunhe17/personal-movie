from app.core.schemas import DetailResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.voucher.facade.voucher_facade import VoucherFacade


async def delete_voucher_handler(
    *,
    voucher_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> DetailResponse:
    name = await VoucherFacade(uow).delete_voucher(voucher_id)

    await emit(
        uow,
        "voucher_deleted",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="deleted",
            _entity_name="voucher",
            _entity_id=voucher_id,
            _payload={"data": {"id": voucher_id, "name": name}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return DetailResponse(detail="삭제되었습니다")


TOOL = {
    "name": "delete_voucher_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "운영자가 바우처 카탈로그 항목을 삭제한다.",
    "keywords": ['delete voucher', "바우처 삭제", "이용권 삭제", "voucher 삭제", "바우처 제거"],
    "boundaries": "운영자 전용 — 바우처 '정의' 삭제. 수정은 update_voucher_handler.",
    "output": "삭제 결과 (DetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "voucher_id": {"type": "string", "format": "uuid", "title": "대상 바우처", "description": "삭제할 바우처 정의의 UUID."},
        },
        "required": ["voucher_id"],
    },
}
