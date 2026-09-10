# extraction write는 form 모듈(FormTemplateFacade)이 소유, admin은 조율·감사·디스패치만.
from __future__ import annotations

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.extraction.models import FormExtractionStatus
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic

from app.modules.platform_admin.form.schemas import FormExtractionAcceptedResponse



async def retry_form_extraction_handler(
    *,
    extraction_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> FormExtractionAcceptedResponse:
    await FormTemplateFacade(uow).reset_extraction_for_retry(extraction_id)

    await emit(
        uow,
        "form_extraction_retried",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="retried",
            _entity_name="form_extraction",
            _entity_id=extraction_id,
            _payload={"data": {"id": extraction_id}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return FormExtractionAcceptedResponse(
        id=extraction_id,
        status=FormExtractionStatus.PROCESSING,
        message="서식 가공을 다시 시작했습니다. 완료까지 약 30초~2분 소요됩니다.",
    )


TOOL = {
    "name": "retry_form_extraction_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "실패한 폼 추출을 재시도한다.",
    "keywords": ["폼 추출 재시도", "extraction retry"],
    "boundaries": "운영자 전용 — 폼 추출 재시도. 새 추출은 create_form_extraction_from_document_handler.",
    "output": "재시도 접수 결과 (FormExtractionAcceptedResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "extraction_id": {'type': 'string', 'format': 'uuid', 'title': '대상 추출', 'description': '재시도할 폼 추출의 UUID.'},
        },
        "required": ["extraction_id"],
    },
}
