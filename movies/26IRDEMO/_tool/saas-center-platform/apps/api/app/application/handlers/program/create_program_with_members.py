from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.center.program.schemas import ProgramCreate, ProgramResponse
from app.modules.center.facade import ProgramFacade
from app.modules.center.facade import ProgramMemberFacade


async def create_program_with_members_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: ProgramCreate,
    uow: UnitOfWork,
    actor_id: str | None,
) -> ProgramResponse:
    program_facade = ProgramFacade(uow)
    program_atomic, program = await program_facade.create_program(
        center_id=center_id,
        name=data.name,
        program_type=data.program_type.value,
        price=data.price,
        duration_minutes=data.duration_minutes,
        description=data.description,
    )

    pm_facade = ProgramMemberFacade(uow)
    member_atomics, _ = await pm_facade.assign_members(
        center_id=center_id,
        program_id=program.id,
        member_ids=data.member_ids,
    )

    await emit(
        uow,
        "program_created",
        event_group_id=event_group_id,
        atomics=[program_atomic, *member_atomics],
        center_id=center_id,
        actor_id=actor_id,
    )
    return ProgramResponse.model_validate(program)


TOOL = {
    "name": "create_program_with_members_handler",
    "permission": "write:program",
    "purpose": "센터에 새 상담·검사 프로그램을 만들고 담당 멤버를 배정한다.",
    "keywords": [
        "create program",
        "프로그램 생성",
        "프로그램 등록",
        "프로그램 만들기",
        "상담 프로그램 추가",
        "신규 프로그램",
        "프로그램 개설",
        "program 생성",
        "코스 추가",
    ],
    "boundaries": "새 프로그램을 '생성'하는 도구다. 목록 조회는 list_programs_enriched_handler를 쓴다. 생성 시 담당 멤버(member_ids)가 함께 배정되며, 가격·소요시간 등 프로그램 속성을 같이 등록한다.",
    "output": "생성된 프로그램 (ProgramResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "프로그램을 만들 센터의 UUID.",
            },
            "name": {
                "description": "프로그램명.",
                "maxLength": 100,
                "minLength": 1,
                "title": "프로그램명",
                "type": "string",
            },
            "member_ids": {
                "description": "담당자 멤버 UUID 목록(최소 1명).",
                "items": {"type": "string"},
                "minItems": 1,
                "title": "담당자 목록",
                "type": "array",
            },
            "program_type": {
                "$ref": "#/$defs/ProgramType",
                "description": "유형: INDIVIDUAL(개인)/GROUP(집단).",
            },
            "description": {
                "anyOf": [{"maxLength": 1000, "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "프로그램 설명(선택).",
                "title": "설명",
            },
            "price": {
                "description": "가격(원, 최대 1억).",
                "maximum": 100000000,
                "minimum": 0,
                "title": "가격",
                "type": "integer",
            },
            "duration_minutes": {
                "description": "소요 시간(분, 최대 480).",
                "maximum": 480,
                "minimum": 1,
                "title": "소요 시간",
                "type": "integer",
            },
        },
        "$defs": {
            "ProgramType": {
                "enum": ["INDIVIDUAL", "GROUP"],
                "title": "ProgramType",
                "type": "string",
            }
        },
        "required": [
            "center_id",
            "name",
            "member_ids",
            "program_type",
            "price",
            "duration_minutes",
        ],
    },
}
