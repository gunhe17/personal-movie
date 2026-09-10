from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.voucher.schemas import ExtractionAcceptedResponse
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.modules.voucher.voucher_extraction.models import VoucherExtractionStatus


async def resume_voucher_extraction_handler(
    *,
    extraction_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> ExtractionAcceptedResponse:
    # progress.data 는 그대로 — 멈춘 지점부터 이어간다. 잡 투입은 이벤트 반응이 한다.
    await VoucherFacade(uow).resume_extraction(extraction_id)

    await emit(
        uow,
        "voucher_extraction_resumed",
        event_group_id=event_group_id,
        atomics=[
            AdminAuditAtomic(
                _act="resumed",
                _entity_name="voucher_extraction",
                _entity_id=extraction_id,
                _payload={"data": {"id": extraction_id}},
            )
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    # return
    return ExtractionAcceptedResponse(
        id=extraction_id,
        status=VoucherExtractionStatus.PROCESSING,
        message="멈춘 지점부터 가공을 이어갑니다.",
    )


TOOL = {
    "name": "resume_voucher_extraction_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "중단된 바우처 가공을 멈춘 지점부터 재개한다.",
    "keywords": ["가공 재개", "추출 이어하기"],
    "boundaries": "운영자 전용 — 진행분(progress.data)을 유지한 채 이어간다. 처음부터 다시는 재추출.",
    "output": "재개 접수 결과 (ExtractionAcceptedResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "extraction_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 추출",
                "description": "재개할 바우처 추출의 UUID.",
            },
        },
        "required": ["extraction_id"],
    },
}
