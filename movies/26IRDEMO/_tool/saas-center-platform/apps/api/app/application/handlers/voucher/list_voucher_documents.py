from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.voucher.facade.voucher_facade import VoucherFacade

from app.modules.platform_admin.voucher.schemas import VoucherDocumentLinkResponse
from app.infrastructure.persistence.range import to_tuple


async def list_voucher_documents_handler(
    voucher_id: str, uow: UnitOfWork
) -> list[VoucherDocumentLinkResponse]:
    voucher_facade = VoucherFacade(uow)
    await voucher_facade.verify_voucher_exists(voucher_id)

    links = await voucher_facade.list_documents_by_voucher(voucher_id)

    docs_by_id = {}
    if links:
        ids = [link.global_document_id for link in links]
        gdoc_facade = GlobalDocumentFacade(uow)
        rows = await gdoc_facade.get_many(ids)
        docs_by_id = {d.id: d for d in rows}

    result: list[VoucherDocumentLinkResponse] = []
    for link in links:
        doc = docs_by_id.get(link.global_document_id)
        result.append(
            VoucherDocumentLinkResponse(
                id=link.id,
                voucher_id=link.voucher_id,
                global_document_id=link.global_document_id,
                page_range=to_tuple(link.page_range),
                name=doc.name if doc else None,
                file_type=doc.file_type if doc else None,
                deleted_at=doc.deleted_at if doc else None,
                created_at=link.created_at,
            )
        )
    return result


TOOL = {
    "name": "list_voucher_documents_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "바우처에 연결된 문서 목록을 조회한다.",
    "keywords": ["바우처 문서 목록", "연결 문서 조회"],
    "boundaries": "운영자 전용 — 한 바우처의 연결 문서 목록(읽기). 연결은 create_voucher_document_handler.",
    "output": "바우처에 연결된 문서 목록 (VoucherDocumentLinkResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 바우처",
                "description": "연결 문서를 조회할 바우처의 UUID.",
            },
        },
        "required": ["voucher_id"],
    },
}
