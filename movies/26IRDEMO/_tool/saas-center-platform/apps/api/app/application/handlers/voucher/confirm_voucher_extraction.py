# write=voucher 모듈(VoucherFacade.confirm_extraction) 소유, admin은 조율·감사만.
# extraction은 status=completed 유지(삭제 안 함), forms는 deferred.
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.voucher.facade.voucher_facade import VoucherFacade

from app.modules.platform_admin.voucher.schemas import (
    ConfirmedVoucherItem,
    ConfirmExtractionRequest,
    ConfirmExtractionResponse,
)


async def confirm_voucher_extraction_handler(
    *,
    extraction_id: str,
    data: ConfirmExtractionRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> ConfirmExtractionResponse:
    result = await VoucherFacade(uow).confirm_extraction(
        extraction_id=extraction_id,
        vouchers=[v.model_dump() for v in data.vouchers],
    )

    await emit(
        uow,
        "voucher_extraction_confirmed",
        event_group_id=event_group_id,
        atomics=[
            AdminAuditAtomic(
                _act="confirmed",
                _entity_name="voucher_extraction",
                _entity_id=extraction_id,
                _payload={
                    "data": {
                        "id": extraction_id,
                        "voucher_count": len(result.items),
                        "voucher_created_count": result.voucher_created_count,
                        "voucher_reused_count": result.voucher_reused_count,
                        "link_created_count": result.link_created_count,
                    }
                },
            )
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return ConfirmExtractionResponse(
        extraction_id=extraction_id,
        items=[
            ConfirmedVoucherItem(
                voucher_id=item.voucher_id,
                name=item.name,
                program_year=item.program_year,
                voucher_created=item.voucher_created,
                link_created_count=item.link_created_count,
            )
            for item in result.items
        ],
        voucher_created_count=result.voucher_created_count,
        voucher_reused_count=result.voucher_reused_count,
        link_created_count=result.link_created_count,
    )


TOOL = {
    "name": "confirm_voucher_extraction_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "AI가 추출한 바우처 결과를 확인·확정한다.",
    "keywords": ["바우처 추출 확정", "추출 승인", "confirm voucher extraction"],
    "boundaries": "운영자 전용 — 추출된 바우처를 '확정'. 추출 업로드는 upload_voucher_extraction_handler.",
    "output": "추출 확정 결과 (ConfirmExtractionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "extraction_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 추출",
                "description": "확정할 바우처 추출의 UUID.",
            },
            "vouchers": {
                "items": {"$ref": "#/$defs/ConfirmExtractionVoucherItem"},
                "minItems": 1,
                "title": "확정 바우처 목록",
                "type": "array",
                "description": "AI 추출 결과를 검토·편집한 확정 바우처 목록(최소 1건).",
            },
        },
        "$defs": {
            "ConfirmExtractionVoucherItem": {
                "properties": {
                    "name": {"maxLength": 255, "title": "Name", "type": "string"},
                    "program_name": {
                        "maxLength": 255,
                        "title": "Program Name",
                        "type": "string",
                    },
                    "program_organization": {
                        "maxLength": 255,
                        "title": "Program Organization",
                        "type": "string",
                    },
                    "program_year": {
                        "maximum": 2999,
                        "minimum": 1900,
                        "title": "Program Year",
                        "type": "integer",
                    },
                    "usage_start_date": {
                        "anyOf": [
                            {"format": "date", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "title": "Usage Start Date",
                    },
                    "usage_end_date": {
                        "anyOf": [
                            {"format": "date", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "title": "Usage End Date",
                    },
                    "application_method": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "title": "Application Method",
                    },
                    "application_start_date": {
                        "anyOf": [
                            {"format": "date", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "title": "Application Start Date",
                    },
                    "application_end_date": {
                        "anyOf": [
                            {"format": "date", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "title": "Application End Date",
                    },
                    "support_amount": {
                        "anyOf": [
                            {"additionalProperties": True, "type": "object"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "title": "Support Amount",
                    },
                    "record": {
                        "anyOf": [
                            {"additionalProperties": True, "type": "object"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "title": "Record",
                    },
                    "support_scope": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "title": "Support Scope",
                    },
                    "support_target": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "title": "Support Target",
                    },
                    "contact": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "title": "Contact",
                    },
                    "page_range": {
                        "anyOf": [
                            {
                                "maxItems": 2,
                                "minItems": 2,
                                "prefixItems": [
                                    {"type": "integer"},
                                    {"type": "integer"},
                                ],
                                "type": "array",
                            },
                            {"type": "null"},
                        ],
                        "default": None,
                        "title": "Page Range",
                    },
                },
                "required": [
                    "name",
                    "program_name",
                    "program_organization",
                    "program_year",
                ],
                "title": "ConfirmExtractionVoucherItem",
                "type": "object",
            }
        },
        "required": ["extraction_id", "vouchers"],
    },
}
