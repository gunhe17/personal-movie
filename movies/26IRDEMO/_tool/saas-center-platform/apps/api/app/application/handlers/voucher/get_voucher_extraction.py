from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.voucher.facade.voucher_facade import VoucherFacade

from app.modules.platform_admin.voucher.schemas import (
    VoucherExtractionDetail,
    VoucherExtractionDocumentItem,
)


async def get_voucher_extraction_handler(
    extraction_id: str, uow: UnitOfWork
) -> VoucherExtractionDetail:
    storage = get_storage_client()
    voucher_facade = VoucherFacade(uow)
    gdoc_facade = GlobalDocumentFacade(uow, storage)
    extraction = await voucher_facade.get_extraction(extraction_id)

    # 조회는 읽기만 한다 — 전진은 워커(job_type=voucher_extract)가 자기 수명으로 돌린다.
    # 폴링 안에서 전진시키던 종전 구조는 요청이 끊기면 스테이지가 통째로 죽어 LLM 결과를
    # 버렸다(2026-08-31 실측 3회). 멈춘 건은 cron 안전망이 잡을 다시 넣는다.

    completed = extraction.completed or {}

    # 입력 원본 / 산출물 분리 요약 (각 배열 순서 보존) + 다운로드 presigned URL
    all_ids = extraction.all_document_ids
    by_id = {}
    url_by_id: dict[str, str | None] = {}
    if all_ids:
        docs = await gdoc_facade.get_many(all_ids)
        by_id = {d.id: d for d in docs}
        for d in docs:
            url_by_id[d.id] = await storage.get_presigned_url(path=d.storage_path)

    def _items(ids: list[str]) -> list[VoucherExtractionDocumentItem]:
        items: list[VoucherExtractionDocumentItem] = []
        for did in ids or []:
            d = by_id.get(did)
            if d is not None:
                items.append(
                    VoucherExtractionDocumentItem(
                        id=d.id,
                        name=d.name,
                        file_type=d.file_type,
                        url=url_by_id.get(d.id),
                    )
                )
        return items

    source_documents = _items(extraction.source_document_ids)
    artifact_documents = _items(extraction.artifact_document_ids)

    # 문서 단위 메타 (전 후보 공유)
    meta = completed.get("meta") or {}
    if not isinstance(meta, dict):
        meta = {}

    # 후보 목록
    candidates = completed.get("vouchers") or []
    if not isinstance(candidates, list):
        candidates = []

    # 서식 판정 페이지 — 화면이 바우처 span 으로 갈라 쓴다
    forms = completed.get("forms") or []
    if not isinstance(forms, list):
        forms = []

    # latency
    latency_ms: int | None = None
    if extraction.started_at is not None and extraction.completed_at is not None:
        delta = extraction.completed_at - extraction.started_at
        latency_ms = int(delta.total_seconds() * 1000)

    return VoucherExtractionDetail(
        id=extraction.id,
        status=extraction.status,
        type=completed.get("type"),
        source_url=completed.get("source_url"),
        source_documents=source_documents,
        artifact_documents=artifact_documents,
        meta=meta,
        candidates=candidates,
        forms=forms,
        progress=extraction.progress,
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
    "name": "get_voucher_extraction_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "바우처 추출 작업 상세를 조회한다.",
    "keywords": ["바우처 추출 조회", "extraction 상세"],
    "boundaries": "운영자 전용 — 바우처 추출 상세(읽기). 목록은 list_voucher_extractions_handler.",
    "output": "바우처 추출 작업 상세 (VoucherExtractionDetail).",
    "input_schema": {
        "type": "object",
        "properties": {
            "extraction_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 추출",
                "description": "조회할 바우처 추출의 UUID.",
            },
        },
        "required": ["extraction_id"],
    },
}
