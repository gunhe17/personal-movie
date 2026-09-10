# extraction write=voucher 모듈(VoucherFacade) 소유, admin은 조율·감사·디스패치만.
# dispatch 실패 시 별도 세션으로 status=failed 마킹 후 re-raise (started 고착 방지).
from __future__ import annotations

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.modules.voucher.voucher_extraction.models import (
    VoucherExtractionStatus,
)

from app.modules.platform_admin.voucher.schemas import ExtractionAcceptedResponse


async def retry_voucher_extraction_handler(
    *,
    extraction_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> ExtractionAcceptedResponse:
    await VoucherFacade(uow).reset_extraction_for_retry(extraction_id)

    await emit(
        uow,
        "voucher_extraction_retried",
        event_group_id=event_group_id,
        atomics=[
            AdminAuditAtomic(
                _act="retried",
                _entity_name="voucher_extraction",
                _entity_id=extraction_id,
                _payload={"data": {"id": extraction_id}},
            )
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return ExtractionAcceptedResponse(
        id=extraction_id,
        status=VoucherExtractionStatus.PROCESSING,
        message="가공을 다시 시작했습니다. 완료까지 약 1~3분 소요됩니다.",
    )


TOOL = {
    "name": "retry_voucher_extraction_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "실패한 바우처 추출을 재시도한다.",
    "keywords": ["바우처 추출 재시도", "extraction retry"],
    "boundaries": "운영자 전용 — 바우처 추출 재시도. 업로드는 upload_voucher_extraction_handler.",
    "output": "재시도 접수 결과 (ExtractionAcceptedResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "extraction_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 추출",
                "description": "재시도할 바우처 추출의 UUID.",
            },
        },
        "required": ["extraction_id"],
    },
}
