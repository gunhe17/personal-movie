from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.voucher.schemas import (
    ConfirmLayoutRequest,
    ExtractionAcceptedResponse,
)
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.modules.voucher.voucher_extraction.models import VoucherExtractionStatus


async def confirm_voucher_layout_handler(
    *,
    extraction_id: str,
    data: ConfirmLayoutRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> ExtractionAcceptedResponse:
    # 확정본(영역·서식 구간)이 정본이 되고, 2단계(내용 추출)를 깨운다 — 잡 투입은 이벤트 반응
    await VoucherFacade(uow).confirm_extraction_layout(
        extraction_id,
        spans=[s.model_dump() for s in data.spans],
        forms=[f.model_dump() for f in data.forms],
    )

    await emit(
        uow,
        "voucher_extraction_layout_confirmed",
        event_group_id=event_group_id,
        atomics=[
            AdminAuditAtomic(
                _act="layout_confirmed",
                _entity_name="voucher_extraction",
                _entity_id=extraction_id,
                _payload={
                    "data": {
                        "id": extraction_id,
                        "span_count": len(data.spans),
                        "form_count": len(data.forms),
                    }
                },
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
        message=f"영역 {len(data.spans)}건·서식 {len(data.forms)}건 확정 — 내용 추출을 시작합니다.",
    )


TOOL = {
    "name": "confirm_voucher_layout_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "바우처 영역·서식 정의를 확정하고 내용 추출(2단계)을 시작한다.",
    "keywords": ["영역 확정", "서식 확정", "추출 시작"],
    "boundaries": "운영자 전용 — 영역 확정 대기(review) 상태만. 확정본이 이후 추출의 정본.",
    "output": "확정 접수 결과 (ExtractionAcceptedResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "extraction_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 추출",
                "description": "확정할 바우처 추출의 UUID.",
            },
        },
        "required": ["extraction_id"],
    },
}
