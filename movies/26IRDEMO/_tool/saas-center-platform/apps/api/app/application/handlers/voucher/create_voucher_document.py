# write=voucher 모듈(VoucherFacade.link_document) 소유, admin은 조율·감사만.
# 멱등: 같은 (voucher, global_document) 링크가 이미 활성이면 그대로 반환.
from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.voucher.facade.voucher_facade import VoucherFacade

from app.modules.platform_admin.voucher.schemas import (
    VoucherDocumentLinkCreateRequest,
    VoucherDocumentLinkResponse,
)
from app.infrastructure.persistence.range import to_tuple


async def create_voucher_document_handler(
    *,
    voucher_id: str,
    data: VoucherDocumentLinkCreateRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> VoucherDocumentLinkResponse:
    facade = VoucherFacade(uow)
    voucher = await facade.verify_voucher_exists(voucher_id)

    docs = await GlobalDocumentFacade(uow).get_many([data.global_document_id])
    if not docs:
        raise EntityNotFoundException(
            f"문서를 찾을 수 없습니다: {data.global_document_id}"
        )
    doc = docs[0]

    link, created = await facade.link_document(
        voucher_id=voucher_id,
        global_document_id=data.global_document_id,
        page_range=data.page_range,
    )
    if created:
        await emit(
            uow,
            "voucher_document_created",
            event_group_id=event_group_id,
            atomics=[
                AdminAuditAtomic(
                    _act="created",
                    _entity_name="voucher_document",
                    _entity_id=link.id,
                    _payload={
                        "data": {
                            "id": link.id,
                            "voucher_id": voucher_id,
                            "global_document_id": data.global_document_id,
                        }
                    },
                )
            ],
            actor_id=actor_id,
            actor_type="admin",
            ip_address=ip,
        )

    return VoucherDocumentLinkResponse(
        id=link.id,
        voucher_id=link.voucher_id,
        global_document_id=link.global_document_id,
        page_range=to_tuple(link.page_range),
        name=doc.name,
        file_type=doc.file_type,
        deleted_at=doc.deleted_at,
        created_at=link.created_at,
    )


TOOL = {
    "name": "create_voucher_document_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "바우처에 문서를 연결한다.",
    "keywords": ["바우처 문서 연결", "바우처 자료 추가", "voucher document 생성"],
    "boundaries": "운영자 전용 — 바우처에 문서 연결. 목록은 list_voucher_documents_handler, 해제는 delete_voucher_document_handler.",
    "output": "연결된 바우처 문서 (VoucherDocumentLinkResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 바우처",
                "description": "문서를 연결할 바우처의 UUID.",
            },
            "global_document_id": {
                "title": "연결 문서",
                "type": "string",
                "description": "연결할 global_document의 UUID.",
            },
            "page_range": {
                "anyOf": [
                    {
                        "maxItems": 2,
                        "minItems": 2,
                        "prefixItems": [{"type": "integer"}, {"type": "integer"}],
                        "type": "array",
                    },
                    {"type": "null"},
                ],
                "default": None,
                "title": "페이지 범위",
                "description": "문서 내 해당 바우처 위치 [low, high](선택).",
            },
        },
        "required": ["voucher_id", "global_document_id"],
    },
}
