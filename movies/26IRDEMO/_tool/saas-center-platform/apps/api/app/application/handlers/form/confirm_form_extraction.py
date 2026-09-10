# write는 form 모듈(FormTemplateFacade.confirm_extraction)이 소유, admin은 조율·감사만.
# extraction은 status=completed 유지(삭제 안 함, 이력·재추출용).
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.voucher.facade.voucher_facade import VoucherFacade

from app.modules.platform_admin.form.schemas import (
    ConfirmFormExtractionRequest,
    ConfirmFormExtractionResponse,
)


async def confirm_form_extraction_handler(
    *,
    extraction_id: str,
    data: ConfirmFormExtractionRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> ConfirmFormExtractionResponse:
    template_atomics, result = await FormTemplateFacade(uow).confirm_extraction(
        extraction_id=extraction_id,
        name=data.name,
        schema=data.schema_,
    )
    template = result.template

    # link — 이 서식을 쓰는 바우처들. 귀속은 추론하지 않는다(화면의 소속 선택이 정본).
    linked = 0
    for voucher_id in data.voucher_ids:
        _, created = await VoucherFacade(uow).link_form_template(
            voucher_id, template.id, kind=data.kind
        )
        linked += 1 if created else 0

    await emit(
        uow,
        "form_extraction_confirmed",
        event_group_id=event_group_id,
        atomics=[
            *template_atomics,
            AdminAuditAtomic(
                _act="confirmed",
                _entity_name="form_extraction",
                _entity_id=extraction_id,
                _payload={
                    "data": {
                        "id": extraction_id,
                        "template_id": template.id,
                        "name": template.name,
                        "version": template.version,
                        "created": result.created,
                        "linked_vouchers": linked,
                    }
                },
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return ConfirmFormExtractionResponse(
        extraction_id=extraction_id,
        template_id=template.id,
        name=template.name,
        version=template.version,
        status=template.status,
        created=result.created,
    )


TOOL = {
    "name": "confirm_form_extraction_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "AI가 추출한 폼 결과를 확인·확정한다.",
    "keywords": ["폼 추출 확정", "추출 결과 승인", "confirm form extraction"],
    "boundaries": "운영자 전용 — 문서에서 AI 추출한 폼을 '확정'. 추출 시작은 create_form_extraction_from_document_handler.",
    "output": "확정 결과 — 생성된 form_template (ConfirmFormExtractionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "extraction_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 추출",
                "description": "확정할 폼 추출의 UUID.",
            },
            "name": {
                "description": "생성할 form_template 이름.",
                "maxLength": 100,
                "title": "서식 이름",
                "type": "string",
            },
            "schema": {
                "additionalProperties": True,
                "description": "편집·검토된 FormSchema (pages+fields+elements).",
                "title": "서식 스키마",
                "type": "object",
            },
            "voucher_ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "이 서식을 쓰는 바우처",
                "description": "빈 배열이면 어느 바우처에도 붙이지 않는다.",
            },
        },
        "required": ["extraction_id", "name", "schema"],
    },
}
