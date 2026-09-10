from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.program_facade import ProgramFacade
from ..schemas import ProgramCreate, ProgramResponse


async def create_program_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: ProgramCreate,
    uow: UnitOfWork,
    actor_id: str,
) -> ProgramResponse:
    facade = ProgramFacade(uow)
    atomic, program = await facade.create(
        center_id=center_id,
        name=data.name,
        program_type=data.program_type.value,
        price=data.price,
        duration_minutes=data.duration_minutes,
        description=data.description,
    )
    await emit(
        uow,
        "program_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return ProgramResponse.model_validate(program)


TOOL = {
    "name": 'create_program_handler',
    "permission": None,
    "agent_exposed": False,  # 표면은 application create_program_handler(이미 노출)
    "purpose": '센터 프로그램을 생성한다.',
    "keywords": ['프로그램 생성', '프로그램 등록', 'program 생성'],
    "boundaries": '모듈 프로그램 생성. 담당 멤버 배정까지 함께하는 건 application의 create_program_handler.',
    "output": '생성된 프로그램 (ProgramResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'name': {'description': '프로그램명.', 'maxLength': 100, 'minLength': 1, 'title': '프로그램명', 'type': 'string'},
            'member_ids': {'description': '담당자 멤버 UUID 목록(최소 1명).', 'items': {'type': 'string'}, 'minItems': 1, 'title': '담당자 목록', 'type': 'array'},
            'program_type': {'$ref': '#/$defs/ProgramType', 'description': '유형: INDIVIDUAL(개인)/GROUP(집단).'},
            'description': {'anyOf': [{'maxLength': 1000, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '프로그램 설명(선택).', 'title': '설명'},
            'price': {'description': '가격(원, 최대 1억).', 'maximum': 100000000, 'minimum': 0, 'title': '가격', 'type': 'integer'},
            'duration_minutes': {'description': '소요 시간(분, 최대 480).', 'maximum': 480, 'minimum': 1, 'title': '소요 시간', 'type': 'integer'},
        },
        "$defs": {'ProgramType': {'enum': ['INDIVIDUAL', 'GROUP'], 'title': 'ProgramType', 'type': 'string'}},
        "required": ['name', 'member_ids', 'program_type', 'price', 'duration_minutes'],
    },
}
