from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import DocumentResponse, DocumentUpdate
from ...facade import DocumentFacade


async def update_document_handler(
    *,
    event_group_id: uuid_str,
    document_id: str,
    data: DocumentUpdate,
    center_id: str,
    account_id: str,
    ip_address: str | None,
    user_agent: str | None,
    uow: UnitOfWork,
    actor_id: str,
) -> DocumentResponse:
    facade = DocumentFacade(uow)
    atomic, document = await facade.update_document_with_log(
        document_id=document_id,
        center_id=center_id,
        changed=data.model_dump(mode="json", exclude_unset=True),
        account_id=account_id,
        action="update",
        ip_address=ip_address,
        user_agent=user_agent,
        # None 필드 드롭 → service unset 기본값 적용(기존 exclude_none 동작 유지)
        **data.model_dump(exclude_none=True),
    )
    await emit(
        uow,
        "document_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return DocumentResponse.model_validate(document)


TOOL = {
    "name": 'update_document_handler',
    "permission": "write:document",
    "purpose": '문서 메타정보를 수정한다.',
    "keywords": ['update document', '문서 수정', '자료 편집', 'document 수정'],
    "boundaries": '문서 메타 수정. 업로드는 upload_document_handler.',
    "output": '수정된 문서 (DocumentResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'document_id': {'type': 'string', 'format': 'uuid', 'title': '대상 문서', 'description': '수정할 문서의 UUID.'},
            'name': {'anyOf': [{'maxLength': 255, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '문서명', 'description': '문서 이름(미지정 시 유지).'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '문서 설명(미지정 시 유지).'},
            'file_type': {'anyOf': [{'maxLength': 100, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '파일 형식', 'description': '파일 MIME/형식(미지정 시 유지).'},
            'file_size': {'anyOf': [{'exclusiveMinimum': 0, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '파일 크기', 'description': '파일 크기(바이트, 미지정 시 유지).'},
            'checksum': {'anyOf': [{'maxLength': 64, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '체크섬', 'description': '파일 체크섬(미지정 시 유지).'},
            'access_level': {'anyOf': [{'$ref': '#/$defs/AccessLevel'}, {'type': 'null'}], 'default': None, 'description': '공개 범위: center(센터 내부)/public(공개, 미지정 시 유지).'},
        },
        "$defs": {'AccessLevel': {'enum': ['center', 'public'], 'title': 'AccessLevel', 'type': 'string'}},
        "required": ['document_id'],
    },
}
