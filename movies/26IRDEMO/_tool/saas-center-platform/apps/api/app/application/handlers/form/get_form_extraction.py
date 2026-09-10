from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.form.facade import FormExtractionFacade

from app.modules.platform_admin.form.schemas import (
    FormExtractionDetail,
    FormExtractionDocumentItem,
)


async def get_form_extraction_handler(
    extraction_id: str, uow: UnitOfWork
) -> FormExtractionDetail:
    extraction = await FormExtractionFacade(uow).find_extraction(extraction_id)
    if extraction is None or extraction.deleted_at is not None:
        raise EntityNotFoundException(f"추출 작업을 찾을 수 없습니다: {extraction_id}")

    # 입력/산출 문서 요약
    ids = [extraction.source_document_id]
    if extraction.image_document_id:
        ids.append(extraction.image_document_id)
    gdoc_facade = GlobalDocumentFacade(uow)
    docs = {d.id: d for d in await gdoc_facade.get_many(ids)}

    def _item(doc_id: str | None) -> FormExtractionDocumentItem | None:
        d = docs.get(doc_id) if doc_id else None
        if d is None:
            return None
        return FormExtractionDocumentItem(id=d.id, name=d.name, file_type=d.file_type)

    # latency
    latency_ms: int | None = None
    if extraction.started_at and extraction.completed_at:
        delta = extraction.completed_at - extraction.started_at
        latency_ms = int(delta.total_seconds() * 1000)

    return FormExtractionDetail(
        id=extraction.id,
        status=extraction.status,
        name=extraction.name,
        center_id=extraction.center_id,
        source_document=_item(extraction.source_document_id),
        image_document=_item(extraction.image_document_id),
        schema=extraction.completed,
        started_at=extraction.started_at,
        completed_at=extraction.completed_at,
        failed_at=extraction.failed_at,
        latency_ms=latency_ms,
        failed=extraction.failed,
        created_at=extraction.created_at,
        updated_at=extraction.updated_at,
        deleted_at=extraction.deleted_at,
    )


TOOL = {
    "name": "get_form_extraction_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "폼 추출 작업 상세를 조회한다.",
    "keywords": ["폼 추출 조회", "extraction 상세"],
    "boundaries": "운영자 전용 — 폼 추출 상세(읽기). 목록은 list_form_extractions_handler.",
    "output": "폼 추출 상세 — 진행 상태·결과 (FormExtractionDetail).",
    "input_schema": {
        "type": "object",
        "properties": {
            "extraction_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 추출",
                "description": "조회할 폼 추출의 UUID.",
            },
        },
        "required": ["extraction_id"],
    },
}
