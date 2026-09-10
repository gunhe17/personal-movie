from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.value.schemas import ValuesUpsertRequest, ValuesResponse
from app.modules.form.facade.form_facade import FormFacade


async def upsert_answers_handler(
    instance_id: str,
    center_id: str,
    data: ValuesUpsertRequest,
    uow: UnitOfWork,
) -> ValuesResponse:
    facade = FormFacade(uow)
    response = await facade.upsert_answers_with_response(
        center_id=center_id,
        instance_id=instance_id,
        values=[v.model_dump() for v in data.values],
    )
    return response


TOOL = {
    "name": 'upsert_answers_handler',
    "permission": "write:form_instance",
    "purpose": '폼 인스턴스의 답변을 저장한다.',
    "keywords": ['답변 저장', '폼 작성', '응답 저장', 'save answers'],
    "boundaries": "폼 답변 '저장'(임시 포함). 최종 제출은 submit_instance_handler.",
    "output": '저장된 답변 (ValuesResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'instance_id': {'type': 'string', 'format': 'uuid', 'title': '대상 폼', 'description': '답변을 저장할 폼 인스턴스의 UUID.'},
            'values': {'description': '저장할 필드 응답 목록(field_key + value).', 'items': {'$ref': '#/$defs/ValueItem'}, 'title': '응답 목록', 'type': 'array'},
        },
        "$defs": {'ValueItem': {'properties': {'field_key': {'description': '필드 키', 'maxLength': 100, 'title': 'Field Key', 'type': 'string'}, 'group_index': {'default': 0, 'description': '반복 섹션 인덱스 (default 0)', 'minimum': 0, 'title': 'Group Index', 'type': 'integer'}, 'value': {'additionalProperties': True, 'description': '응답 데이터 ({"value": ...})', 'title': 'Value', 'type': 'object'}}, 'required': ['field_key', 'value'], 'title': 'ValueItem', 'type': 'object'}},
        "required": ['instance_id', 'values'],
    },
}
