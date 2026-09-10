from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.document.facade import GlobalDocumentFacade

from app.modules.platform_admin.voucher.schemas import (
    AdminDocumentListResponse,
    AdminDocumentSummary,
)


async def list_global_documents_handler(
    uow: UnitOfWork,
    *,
    q: str | None = None,
    page: int = 1,
    size: int = 20,
) -> AdminDocumentListResponse:
    facade = GlobalDocumentFacade(uow)
    rows, page_meta = await facade.list(q=q, page=page, size=size)

    items = [AdminDocumentSummary.model_validate(d) for d in rows]
    return AdminDocumentListResponse.build(
        items=items, total=page_meta["total"], page=page, size=size
    )


TOOL = {
    "name": "list_global_documents_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "바우처용 전역 문서 목록을 조회한다.",
    "keywords": ["바우처 문서 목록", "전역 문서 조회", "admin document 목록"],
    "boundaries": "운영자 전용 — 바우처에 연결 가능한 문서 목록(읽기). 특정 바우처 문서는 list_voucher_documents_handler.",
    "output": "바우처 연결 가능한 전역 문서 목록 (AdminDocumentListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "q": {
                "type": "string",
                "title": "검색어",
                "description": "문서명 등 검색어(선택).",
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
