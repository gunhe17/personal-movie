from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.extraction.repository import FormExtractionRepository

from ..schemas import FormExtractionListResponse
from ._extraction import build_extraction_summary


async def list_form_extractions_handler(
    uow: UnitOfWork,
    *,
    status: str | None = None,
    center_id: str | None = None,
    page: int = 1,
    size: int = 20,
) -> FormExtractionListResponse:
    repo = uow.repo(FormExtractionRepository)
    rows, page_meta = await repo.list_paginated_with_page(
        status=status, center_id=center_id, page=page, size=size
    )
    items = [build_extraction_summary(r) for r in rows]
    return FormExtractionListResponse.build(
        items=items, total=page_meta["total"], page=page, size=size
    )


TOOL = {
    "name": "list_form_extractions_handler",
    "permission": None,
    "purpose": "폼 추출 작업 목록을 조회한다.",
    "keywords": ["폼 추출 목록", "extraction 리스트"],
    "boundaries": "운영자 전용 — 폼 추출 목록(읽기). 단건은 get_form_extraction_handler.",
    "output": "폼 추출 목록 (FormExtractionListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "추출 상태 필터(선택).",
            },
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "센터 필터",
                "description": "귀속 센터로 필터(선택).",
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
