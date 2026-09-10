from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.program_facade import ProgramFacade
from ...program_member.repository import ProgramMemberRepository
from ...program_member.services import BulkAssignMembersService
from ..schemas import ProgramUpdate, ProgramResponse


async def update_program_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    program_id: str,
    data: ProgramUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> ProgramResponse:
    # PATCH 의미론: exclude_unset으로 전송된 필드만 추출
    update_fields = data.model_dump(exclude_unset=True)

    facade = ProgramFacade(uow)
    atomic, program = await facade.update(
        center_id=center_id,
        program_id=program_id,
        name=update_fields.get("name"),
        program_type=update_fields.get("program_type"),
        description=update_fields.get("description"),
        price=update_fields.get("price"),
        duration_minutes=update_fields.get("duration_minutes"),
        is_active=update_fields.get("is_active"),
        changed=data.model_dump(mode="json", exclude_unset=True),
    )
    # 담당자는 별도 서브모듈(program_member)이라 공통 Service로 동기화 (전송 시에만)
    member_atomics = []
    if (
        update_fields.get("member_ids") is not None
    ):  # null 명시 전송 = 멤버 미변경(None → sync 크래시 방지)
        bulk_assign_service = BulkAssignMembersService(
            uow.repo(ProgramMemberRepository)
        )
        member_atomics, _ = await bulk_assign_service.execute(
            program_id=program_id,
            center_id=center_id,
            member_ids=update_fields["member_ids"],
        )

    await emit(
        uow,
        "program_updated",
        event_group_id=event_group_id,
        atomics=[atomic, *member_atomics],
        center_id=center_id,
        actor_id=actor_id,
    )

    return ProgramResponse.model_validate(program)


TOOL = {
    "name": "update_program_handler",
    "permission": "write:program",
    "purpose": "센터 프로그램을 수정한다.",
    "keywords": ["update program", "프로그램 수정", "program 편집"],
    "boundaries": "프로그램 수정. 생성은 create_program_handler.",
    "output": "수정된 프로그램 (ProgramResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "program_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 프로그램",
                "description": "수정할 프로그램의 UUID.",
            },
            "name": {
                "anyOf": [
                    {"maxLength": 100, "minLength": 1, "type": "string"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "프로그램명(미지정 시 유지).",
                "title": "프로그램명",
            },
            "program_type": {
                "anyOf": [{"$ref": "#/$defs/ProgramType"}, {"type": "null"}],
                "default": None,
                "description": "유형 INDIVIDUAL/GROUP(미지정 시 유지).",
            },
            "description": {
                "anyOf": [{"maxLength": 1000, "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "프로그램 설명(미지정 시 유지).",
                "title": "설명",
            },
            "price": {
                "anyOf": [
                    {"maximum": 100000000, "minimum": 0, "type": "integer"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "가격(원, 미지정 시 유지).",
                "title": "가격",
            },
            "duration_minutes": {
                "anyOf": [
                    {"maximum": 480, "minimum": 1, "type": "integer"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "기본 상담 시간(분, 미지정 시 유지).",
                "title": "소요 시간",
            },
            "is_active": {
                "anyOf": [{"type": "boolean"}, {"type": "null"}],
                "default": None,
                "title": "활성 여부",
                "description": "활성 여부(미지정 시 유지).",
            },
            "member_ids": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "담당자 멤버 UUID 목록(전달 시 전체 교체, 빈 목록이면 전원 해제).",
                "title": "담당자 목록",
            },
        },
        "$defs": {
            "ProgramType": {
                "enum": ["INDIVIDUAL", "GROUP"],
                "title": "ProgramType",
                "type": "string",
            }
        },
        "required": ["program_id"],
    },
}
