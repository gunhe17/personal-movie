# extraction write는 form 모듈(FormTemplateFacade)이 소유, admin은 조율·감사·디스패치만.
# dispatch 실패 시 별도 세션으로 status=failed 마킹 후 re-raise (started 고착 방지).
from __future__ import annotations

from fastapi import UploadFile

from app.infrastructure.storage import get_storage_client
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.document.facade import GlobalDocumentFacade, GlobalFileInput
from app.modules.event import emit
from app.modules.form.extraction.models import FormExtractionStatus
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic

from app.modules.platform_admin.form.schemas import FormExtractionAcceptedResponse



async def upload_form_extraction_handler(
    *,
    name: str,
    center_id: str | None,
    file: UploadFile,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
    uploader_id: str | None = None,
) -> FormExtractionAcceptedResponse:
    # validate
    form_facade = FormTemplateFacade(uow)
    data = await file.read()
    ext = form_facade.validate_extraction_file(
        filename=file.filename, content_type=file.content_type, data=data
    )
    file_input = GlobalFileInput(
        data=data, file_type=ext, content_type=file.content_type
    )

    storage = get_storage_client()

    # create source global_document
    gdoc_facade = GlobalDocumentFacade(uow, storage)
    docs = await gdoc_facade.upload(
        name=name, files=[file_input], uploader_id=uploader_id
    )
    source = docs[0]

    # create extraction (status=started)
    extraction = await form_facade.add_extraction(
        name=name,
        center_id=center_id,
        source_document_id=source.id,
    )

    # 워커 트리거 = form_extraction_created reaction — 이벤트는 behavior 커밋 후에만 보여 레이스 없음
    await emit(
        uow,
        "form_extraction_created",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="created",
            _entity_name="form_extraction",
            _entity_id=extraction.id,
            _payload={"data": {"id": extraction.id, "name": name, "ext": ext}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return FormExtractionAcceptedResponse(
        id=extraction.id,
        status=FormExtractionStatus.PROCESSING,
        message="서식 가공을 시작했습니다. 완료까지 약 30초~2분 소요됩니다.",
    )



TOOL = {
    "name": "upload_form_extraction_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "파일을 올려 폼 추출을 시작한다.",
    "keywords": ["폼 추출 업로드", "파일 폼 추출", "upload form extraction"],
    "boundaries": "운영자 전용 — 파일 업로드로 폼 추출 시작. 문서 기반은 create_form_extraction_from_document_handler.",
    "output": "업로드·추출 접수 결과 (FormExtractionAcceptedResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {'type': 'string', 'title': '서식 이름', 'description': '생성할 form_template 이름.'},
            "center_id": {'type': 'string', 'format': 'uuid', 'title': '귀속 센터', 'description': '귀속 센터 UUID(선택, 없으면 시스템 공용).'},
            "file": {'type': 'string', 'title': '업로드 파일', 'description': '추출 대상 파일(PDF/이미지).'},
        },
        "required": ["name", "file"],
    },
}
