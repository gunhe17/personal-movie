import json

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..._audit import emit_admin_audit
from ...facade import SampleFacade
from ..schemas import ReferenceSegmentsUpdate, SampleDatasetResponse


async def update_sample_reference_handler(
    sample_id: str,
    data: ReferenceSegmentsUpdate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> SampleDatasetResponse:
    segments_json = json.dumps(
        [s.model_dump() for s in data.segments],
        ensure_ascii=False,
    )
    sample = await SampleFacade(uow).update_reference_segments(sample_id, segments_json)
    await emit_admin_audit(
        uow, "sample_dataset_updated",
        act="updated", entity_name="sample_dataset", entity_id=sample.id,
        payload={"input": {"reference_segments": len(data.segments)}},
        event_group_id=event_group_id, actor_id=actor_id, ip=ip,
    )
    return SampleDatasetResponse.model_validate(sample)


TOOL = {
    "name": 'update_sample_reference_handler',
    "permission": None,
    "purpose": '샘플의 정답(레퍼런스) 구간을 설정한다.',
    "keywords": ['레퍼런스 설정', '정답 구간', 'reference 지정', '기준 설정'],
    "boundaries": "샘플의 '정답 레퍼런스'(평가 기준) 설정. 샘플 수정은 update_sample_handler.",
    "output": '정답 구간이 설정된 샘플 (SampleDatasetResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'sample_id': {'type': 'string', 'format': 'uuid', 'title': '대상 샘플', 'description': '레퍼런스를 설정할 샘플의 UUID.'},
            'segments': {'items': {'$ref': '#/$defs/ReferenceSegment'}, 'title': '정답 세그먼트', 'type': 'array', 'description': '화자·텍스트가 라벨된 정답(reference) 세그먼트 목록.'},
        },
        "$defs": {'ReferenceSegment': {'properties': {'speaker': {'title': 'Speaker', 'type': 'string'}, 'text': {'default': '', 'title': 'Text', 'type': 'string'}, 'start': {'default': 0.0, 'title': 'Start', 'type': 'number'}, 'end': {'default': 0.0, 'title': 'End', 'type': 'number'}}, 'required': ['speaker'], 'title': 'ReferenceSegment', 'type': 'object'}},
        "required": ['sample_id', 'segments'],
    },
}
