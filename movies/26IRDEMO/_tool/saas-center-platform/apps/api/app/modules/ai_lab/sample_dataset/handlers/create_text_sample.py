from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..._audit import emit_admin_audit
from ...facade import SampleFacade
from ..schemas import SampleDatasetCreate, SampleDatasetResponse


async def create_text_sample_handler(
    data: SampleDatasetCreate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> SampleDatasetResponse:
    sample = await SampleFacade(uow).create_text_sample(
        name=data.name,
        text_content=data.text_content or "",
        description=data.description,
        tags=data.tags,
        source_type=data.source_type or "manual",
        source_id=data.source_id,
    )
    await emit_admin_audit(
        uow, "sample_dataset_created",
        act="created", entity_name="sample_dataset", entity_id=sample.id,
        payload={"name": sample.name, "input_type": "text"},
        event_group_id=event_group_id, actor_id=actor_id, ip=ip,
    )
    return SampleDatasetResponse.model_validate(sample)


TOOL = {
    "name": 'create_text_sample_handler',
    "permission": None,
    "purpose": '텍스트 샘플 데이터를 생성한다.',
    "keywords": ['텍스트 샘플 생성', 'sample 추가', '텍스트 데이터 등록'],
    "boundaries": '텍스트 샘플 생성. 오디오 업로드는 upload_audio_sample_handler.',
    "output": '생성된 텍스트 샘플 (SampleDatasetResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'name': {'maxLength': 200, 'minLength': 1, 'title': '샘플명', 'type': 'string', 'description': '샘플 데이터셋 이름.'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '샘플 설명(선택).'},
            'input_type': {'pattern': '^(text|audio)$', 'title': '입력 유형', 'type': 'string', 'description': '입력 유형: text 또는 audio.'},
            'text_content': {'anyOf': [{'maxLength': 50000, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '텍스트 내용', 'description': 'text 유형일 때 본문(선택).'},
            'tags': {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '태그', 'description': '분류 태그(선택).'},
            'source_type': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '출처 유형', 'description': '원본 출처 유형(선택).'},
            'source_id': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '출처 ID', 'description': '원본 출처 식별자(선택).'},
        },
        "required": ['name', 'input_type'],
    },
}
