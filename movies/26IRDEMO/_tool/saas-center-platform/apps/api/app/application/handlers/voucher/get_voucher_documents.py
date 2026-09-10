from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.voucher.center_voucher.schemas import (
    CenterVoucherDocumentItem,
    CenterVoucherDocumentsResponse,
)
from app.modules.voucher.facade.center_voucher_facade import CenterVoucherFacade

# 내부 산출물 — 센터엔 노출하지 않는다.
_INTERNAL_FILE_TYPES = {"md"}


async def get_voucher_documents_handler(
    center_id: str,
    center_voucher_id: str,
    uow: UnitOfWork,
) -> CenterVoucherDocumentsResponse:
    links = await CenterVoucherFacade(uow).list_voucher_document_links(
        center_id=center_id,
        center_voucher_id=center_voucher_id,
    )
    if not links:
        return CenterVoucherDocumentsResponse(items=[])

    doc_ids = [link.global_document_id for link in links]
    documents = await GlobalDocumentFacade(uow).get_many(doc_ids)

    doc_by_id = {d.id: d for d in documents}

    items: list[CenterVoucherDocumentItem] = []
    for link in links:
        doc = doc_by_id.get(link.global_document_id)
        if doc is None:
            continue
        if doc.file_type in _INTERNAL_FILE_TYPES:
            continue
        items.append(
            CenterVoucherDocumentItem(
                global_document_id=doc.id,
                name=doc.name,
                file_type=doc.file_type,
                page_range=link.page_range,
                note=None,
                has_file=True,
            )
        )

    return CenterVoucherDocumentsResponse(items=items)


TOOL = {
    "name": "get_voucher_documents_handler",
    "permission": "read:voucher",
    "purpose": "바우처에 첨부된 문서 목록을 조회한다.",
    "keywords": [
        "get voucher documents",
        "바우처 문서 목록",
        "이용권 첨부 목록",
        "바우처 자료",
        "voucher documents",
    ],
    "boundaries": "한 센터 바우처의 첨부 문서 목록(읽기 전용). 파일 다운로드는 get_voucher_document_file_handler.",
    "output": "바우처 첨부 문서 목록 (CenterVoucherDocumentsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터 바우처",
                "description": "첨부 문서를 조회할 센터 바우처의 UUID.",
            },
        },
        "required": ["center_voucher_id"],
    },
}
