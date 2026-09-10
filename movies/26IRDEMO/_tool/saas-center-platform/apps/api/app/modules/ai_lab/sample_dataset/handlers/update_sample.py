from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..._audit import emit_admin_audit
from ...facade import SampleFacade
from ..schemas import SampleDatasetResponse, SampleDatasetUpdate


async def update_sample_handler(
    sample_id: str,
    data: SampleDatasetUpdate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> SampleDatasetResponse:
    sample = await SampleFacade(uow).update_sample(
        # 미전달 필드는 service unset 기본값 적용(omit vs None 구분)
        sample_id, **data.model_dump(exclude_unset=True)
    )
    await emit_admin_audit(
        uow, "sample_dataset_updated",
        act="updated", entity_name="sample_dataset", entity_id=sample.id,
        payload={"input": data.model_dump(mode="json", exclude_unset=True)},
        event_group_id=event_group_id, actor_id=actor_id, ip=ip,
    )
    return SampleDatasetResponse.model_validate(sample)


TOOL = {
    "name": 'update_sample_handler',
    "permission": None,
    "purpose": '샘플 데이터를 수정한다.',
    "keywords": ['샘플 수정', 'sample 편집', '데이터 변경'],
    "boundaries": '샘플 수정. 정답 구간 설정은 update_sample_reference_handler.',
    "output": '수정된 샘플 (SampleDatasetResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'sample_id': {'type': 'string', 'format': 'uuid', 'title': '대상 샘플', 'description': '수정할 샘플의 UUID.'},
            'name': {'anyOf': [{'maxLength': 200, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '샘플명', 'description': '샘플 이름(미지정 시 유지).'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '샘플 설명(미지정 시 유지).'},
            'text_content': {'anyOf': [{'maxLength': 50000, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '텍스트 내용', 'description': '본문(미지정 시 유지).'},
            'tags': {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '태그', 'description': '분류 태그(미지정 시 유지).'},
        },
        "required": ['sample_id'],
    },
}
