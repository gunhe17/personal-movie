# write=voucher 모듈(VoucherFacade.unlink_document) 소유, admin은 조율·감사만.
from app.core.schemas import DetailResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.voucher.facade.voucher_facade import VoucherFacade


async def delete_voucher_document_handler(
    *,
    voucher_id: str,
    global_document_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> DetailResponse:
    link_id = await VoucherFacade(uow).unlink_document(
        voucher_id=voucher_id,
        global_document_id=global_document_id,
    )

    await emit(
        uow,
        "voucher_document_deleted",
        event_group_id=event_group_id,
        atomics=[
            AdminAuditAtomic(
                _act="deleted",
                _entity_name="voucher_document",
                _entity_id=link_id,
                _payload={
                    "data": {
                        "id": link_id,
                        "voucher_id": voucher_id,
                        "global_document_id": global_document_id,
                    }
                },
            )
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return DetailResponse(detail="연결이 해제되었습니다")


TOOL = {
    "name": "delete_voucher_document_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "바우처에 연결된 문서를 해제한다.",
    "keywords": ["바우처 문서 삭제", "문서 연결 해제", "voucher document 삭제"],
    "boundaries": "운영자 전용 — 바우처 문서 연결 해제. 연결은 create_voucher_document_handler.",
    "output": "해제 결과 (DetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 바우처",
                "description": "대상 바우처의 UUID.",
            },
            "global_document_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 문서",
                "description": "해제할 문서의 UUID.",
            },
        },
        "required": ["voucher_id", "global_document_id"],
    },
}
