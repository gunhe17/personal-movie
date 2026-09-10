# 업로드 경로와 달리 새 파일을 만들지 않고 기존 global_document를 source로 참조한다.
# extraction write는 form 모듈(FormTemplateFacade)이 소유, admin은 조율·감사·디스패치만.
from __future__ import annotations

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.event import emit
from app.modules.form.extraction.models import FormExtractionStatus
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic

from app.modules.platform_admin.form.schemas import (
    FormExtractionAcceptedResponse,
    FormExtractionFromDocumentRequest,
)



async def create_form_extraction_from_document_handler(
    *,
    data: FormExtractionFromDocumentRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> FormExtractionAcceptedResponse:
    docs = await GlobalDocumentFacade(uow).get_many([data.source_document_id])
    if not docs:
        raise EntityNotFoundException(
            f"원본 문서를 찾을 수 없습니다: {data.source_document_id}"
        )

    extraction = await FormTemplateFacade(uow).add_extraction(
        name=data.name,
        center_id=data.center_id,
        source_document_id=data.source_document_id,
        page_range=data.page_range,
    )

    await emit(
        uow,
        "form_extraction_created",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="created",
            _entity_name="form_extraction",
            _entity_id=extraction.id,
            _payload={"data": {
                "id": extraction.id,
                "name": data.name,
                "source_document_id": data.source_document_id,
            }},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )
    extraction_id = extraction.id

    return FormExtractionAcceptedResponse(
        id=extraction_id,
        status=FormExtractionStatus.PROCESSING,
        message="서식 가공을 시작했습니다. 완료까지 약 30초~2분 소요됩니다.",
    )


TOOL = {
    "name": 'create_form_extraction_from_document_handler',
    "permission": None,
    "agent_exposed": False,
    "purpose": '문서로부터 AI 폼 추출을 시작한다.',
    "keywords": ['폼 추출 생성', '문서에서 폼 추출', 'form extraction 시작'],
    "boundaries": "운영자 전용 — 문서에서 폼을 AI로 추출 '시작'(비동기). 확정은 confirm_form_extraction_handler.",
    "output": '추출 접수 결과 — 비동기 작업 정보 (FormExtractionAcceptedResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'source_document_id': {'description': '입력 원본 global_document의 UUID.', 'title': '원본 문서', 'type': 'string'},
            'name': {'description': '생성할 form_template 기본 이름.', 'maxLength': 100, 'title': '서식 이름', 'type': 'string'},
            'center_id': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '귀속 센터 UUID (NULL이면 시스템 공용 템플릿).', 'title': '귀속 센터'},
            'page_range': {'anyOf': [{'maxItems': 2, 'minItems': 2, 'prefixItems': [{'type': 'integer'}, {'type': 'integer'}], 'type': 'array'}, {'type': 'null'}], 'default': None, 'description': '다중 페이지 PDF에서 서식 위치 [low, high] (단일 페이지: low==high).', 'title': '페이지 범위'},
        },
        "required": ['source_document_id', 'name'],
    },
}
