from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.platform_admin.voucher.schemas import (
    VoucherExtractionListResponse,
    VoucherExtractionSummary,
)
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.modules.voucher.voucher_extraction.models import VoucherExtraction


async def list_voucher_extractions_handler(
    uow: UnitOfWork,
    *,
    status: str | None = None,
    page: int = 1,
    size: int = 20,
) -> VoucherExtractionListResponse:
    rows, page_meta = await VoucherFacade(uow).list_extractions(
        status=status, page=page, size=size
    )

    # 원본 문서명(global_documents.name) 일괄 해석 — 행마다 N+1 방지
    all_ids = list({did for r in rows for did in r.all_document_ids})
    name_by_id: dict[str, str] = {}
    if all_ids:
        gdoc_facade = GlobalDocumentFacade(uow)
        docs = await gdoc_facade.get_many(all_ids)
        name_by_id = {d.id: d.name for d in docs}

    items = [build_extraction_summary(r, name_by_id) for r in rows]
    return VoucherExtractionListResponse.build(
        items=items, total=page_meta["total"], page=page, size=size
    )


def build_extraction_summary(
    extraction: VoucherExtraction,
    name_by_id: dict[str, str] | None = None,
) -> VoucherExtractionSummary:
    # name_by_id: 문서id→이름 맵 — 대표 문서명 surface용, 목록 핸들러가 일괄 조회해 전달
    name_by_id = name_by_id or {}
    completed = extraction.completed or {}
    candidates = completed.get("vouchers") or []
    doc_ids = extraction.all_document_ids

    # 대표 문서명 — 전체 문서 중 이름이 해석되는 첫 문서
    name = next(
        (name_by_id[d] for d in doc_ids if name_by_id.get(d)),
        None,
    )

    return VoucherExtractionSummary(
        id=extraction.id,
        status=extraction.status,
        name=name,
        type=completed.get("type"),
        document_count=len(doc_ids),
        candidate_count=len(candidates) if isinstance(candidates, list) else 0,
        started_at=extraction.started_at,
        completed_at=extraction.completed_at,
        failed_at=extraction.failed_at,
        created_at=extraction.created_at,
        updated_at=extraction.updated_at,
    )


TOOL = {
    "name": "list_voucher_extractions_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "바우처 추출 작업 목록을 조회한다.",
    "keywords": ["바우처 추출 목록", "extraction 리스트"],
    "boundaries": "운영자 전용 — 바우처 추출 목록(읽기). 단건은 get_voucher_extraction_handler.",
    "output": "바우처 추출 작업 목록 (VoucherExtractionListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "추출 상태 필터(선택).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": [],
    },
}
