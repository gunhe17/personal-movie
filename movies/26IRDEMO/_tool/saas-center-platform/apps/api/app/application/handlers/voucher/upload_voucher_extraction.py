# 업로드가 곧 추출 시작 — 별도 트리거 단계 없음.
# extraction write=voucher 모듈(VoucherFacade) 소유, admin은 조율·감사만.
# 워커 트리거 = voucher_extraction_created reaction — 이벤트는 behavior 커밋 후에만 보인다.
from __future__ import annotations

from fastapi import UploadFile

from app.infrastructure.storage import get_storage_client
from app.core.exceptions import ConflictException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.document.facade import GlobalDocumentFacade, GlobalFileInput
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.modules.voucher.voucher_extraction.models import VoucherExtractionStatus

from app.modules.platform_admin.voucher.schemas import (
    ExtractionAcceptedResponse,
    VoucherFileType,
)


async def upload_voucher_extraction_handler(
    *,
    name: str,
    type: VoucherFileType,
    source_url: str | None,
    files: list[UploadFile],
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
    uploader_id: str | None = None,
) -> ExtractionAcceptedResponse:
    # verify — 중복 확장자 거부
    voucher_facade = VoucherFacade(uow)
    file_inputs: list[GlobalFileInput] = []
    seen_ext: set[str] = set()
    for f in files:
        data = await f.read()
        ext = voucher_facade.validate_extraction_file(
            filename=f.filename, content_type=f.content_type, data=data
        )
        if ext in seen_ext:
            raise ConflictException(f"같은 확장자({ext})의 파일이 두 개 이상 있어요")
        seen_ext.add(ext)
        file_inputs.append(
            GlobalFileInput(data=data, file_type=ext, content_type=f.content_type)
        )

    storage = get_storage_client()

    # create
    gdoc_facade = GlobalDocumentFacade(uow, storage)
    docs = await gdoc_facade.upload(
        name=name, files=file_inputs, uploader_id=uploader_id
    )

    # create — status=started
    extraction = await voucher_facade.add_extraction(
        source_document_ids=[d.id for d in docs],
        completed={
            "type": type.value,
            "source_url": source_url,
            "vouchers": [],
        },
    )

    await emit(
        uow,
        "voucher_extraction_created",
        event_group_id=event_group_id,
        atomics=[
            AdminAuditAtomic(
                _act="created",
                _entity_name="voucher_extraction",
                _entity_id=extraction.id,
                _payload={
                    "data": {"id": extraction.id, "name": name, "file_count": len(docs)}
                },
            )
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )
    return ExtractionAcceptedResponse(
        id=extraction.id,
        status=VoucherExtractionStatus.PROCESSING,
        message="가공을 시작했습니다. 완료까지 약 1~3분 소요됩니다.",
    )


TOOL = {
    "name": "upload_voucher_extraction_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "파일을 올려 바우처 AI 추출을 시작한다.",
    "keywords": ["바우처 추출 업로드", "파일 바우처 추출", "upload voucher extraction"],
    "boundaries": "운영자 전용 — 파일 업로드로 바우처 추출 시작(비동기). 확정은 confirm_voucher_extraction_handler.",
    "output": "추출 접수 결과 — 비동기 시작 (ExtractionAcceptedResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "title": "작업 이름",
                "description": "추출 작업 이름.",
            },
            "type": {
                "type": "string",
                "enum": ["business_guide", "manual", "form", "supplementary", "notice"],
                "title": "파일 유형",
                "description": "바우처 파일 유형.",
            },
            "source_url": {
                "type": "string",
                "title": "원본 URL",
                "description": "원본 URL(선택).",
            },
            "files": {
                "type": "array",
                "items": {"type": "string"},
                "title": "파일 목록",
                "description": "업로드할 파일 목록.",
            },
        },
        "required": ["name", "type", "files"],
    },
}
