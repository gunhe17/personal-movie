from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas_excel import ImportClientsFromExcelRequest, ImportClientsFromExcelResponse
from ...facade.profile_facade import ProfileFacade


async def import_clients_from_excel_handler(
    center_id: str,
    data: ImportClientsFromExcelRequest,
    uow: UnitOfWork,
    actor_id: str,
    *,
    event_group_id: uuid_str,
) -> ImportClientsFromExcelResponse:
    facade = ProfileFacade(uow)
    atomics, result = await facade.import_clients_from_excel_with_response(center_id, data)
    await emit(
        uow,
        "clients_imported",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )
    return result


TOOL = {
    "name": 'import_clients_from_excel_handler',
    "permission": "write:client",
    "purpose": '엑셀 파일로 내담자를 대량 등록한다.',
    "keywords": ['bulk create from excel', '엑셀 내담자 등록', '대량 업로드', '엑셀 일괄 생성', 'bulk excel'],
    "boundaries": "엑셀로 내담자 '대량' 생성. 폼 기반 일괄은 create_clients_handler.",
    "output": '대량 등록 결과 (ImportClientsFromExcelResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'clients': {'items': {'$ref': '#/$defs/ExcelClientRowInput'}, 'minItems': 1, 'title': '엑셀 행 목록', 'type': 'array', 'description': '엑셀에서 파싱한 내담자+보호자 행 목록(최소 1건).'},
        },
        "$defs": {'ExcelClientRowInput': {'description': '엑셀 행 1개 (내담자 + 보호자 정보)', 'properties': {'name': {'description': '내담자 이름', 'title': 'Name', 'type': 'string'}, 'birth_date': {'description': '생년월일 (YYYY-MM-DD)', 'title': 'Birth Date', 'type': 'string'}, 'gender': {'description': '성별 (male/female)', 'title': 'Gender', 'type': 'string'}, 'guardian_name': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '보호자 이름', 'title': 'Guardian Name'}, 'guardian_relationship': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '관계 (엄마/아빠 등)', 'title': 'Guardian Relationship'}, 'guardian_gender': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '보호자 성별 (male/female)', 'title': 'Guardian Gender'}, 'guardian_birth_date': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '보호자 생년월일 (YYYY-MM-DD)', 'title': 'Guardian Birth Date'}, 'guardian_phone': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '보호자 연락처', 'title': 'Guardian Phone'}}, 'required': ['name', 'birth_date', 'gender'], 'title': 'ExcelClientRowInput', 'type': 'object'}},
        "required": ['clients'],
    },
}
