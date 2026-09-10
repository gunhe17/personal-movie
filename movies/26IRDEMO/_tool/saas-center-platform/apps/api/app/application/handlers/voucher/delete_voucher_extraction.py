# write=voucher 모듈(VoucherFacade.delete_extraction) 소유, admin은 조율·감사만.
from app.core.schemas import DetailResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.voucher.facade.voucher_facade import VoucherFacade


async def delete_voucher_extraction_handler(
    *,
    extraction_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> DetailResponse:
    await VoucherFacade(uow).delete_extraction(extraction_id)

    await emit(
        uow,
        "voucher_extraction_deleted",
        event_group_id=event_group_id,
        atomics=[
            AdminAuditAtomic(
                _act="deleted",
                _entity_name="voucher_extraction",
                _entity_id=extraction_id,
                _payload={"data": {"id": extraction_id}},
            )
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return DetailResponse(detail="삭제되었습니다")


TOOL = {
    "name": "delete_voucher_extraction_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "바우처 추출 작업을 삭제한다.",
    "keywords": ["바우처 추출 삭제", "extraction 삭제"],
    "boundaries": "운영자 전용 — 바우처 추출 삭제. 조회는 get_voucher_extraction_handler.",
    "output": "삭제 결과 (DetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "extraction_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 추출",
                "description": "삭제할 바우처 추출의 UUID.",
            },
        },
        "required": ["extraction_id"],
    },
}
