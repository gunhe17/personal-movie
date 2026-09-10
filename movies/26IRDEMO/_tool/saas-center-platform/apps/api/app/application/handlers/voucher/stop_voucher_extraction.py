from app.core.exceptions import InvalidOperationException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.voucher.schemas import ExtractionAcceptedResponse
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.modules.voucher.voucher_extraction.models import VoucherExtractionStatus


async def stop_voucher_extraction_handler(
    *,
    extraction_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> ExtractionAcceptedResponse:
    # 표식만 남긴다 — 실행자가 다음 전진 경계에서 멈춰 진행분(progress.data)을 보존한다.
    # 즉시 죽이면 그 스테이지에 태운 토큰이 버려진다.
    requested = await VoucherFacade(uow).request_stop_extraction(extraction_id)
    if not requested:
        raise InvalidOperationException("진행 중인 가공만 중단할 수 있습니다.")

    await emit(
        uow,
        "voucher_extraction_stopped",
        event_group_id=event_group_id,
        atomics=[
            AdminAuditAtomic(
                _act="stopped",
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
        message="중단을 요청했습니다. 진행 중인 단계를 마치는 대로 멈춥니다.",
    )


TOOL = {
    "name": "stop_voucher_extraction_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "진행 중인 바우처 가공을 중단 요청한다.",
    "keywords": ["가공 중단", "추출 정지"],
    "boundaries": "운영자 전용 — processing 상태만. 진행분은 보존되며 재개로 이어간다.",
    "output": "중단 접수 결과 (ExtractionAcceptedResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "extraction_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 추출",
                "description": "중단할 바우처 추출의 UUID.",
            },
        },
        "required": ["extraction_id"],
    },
}
