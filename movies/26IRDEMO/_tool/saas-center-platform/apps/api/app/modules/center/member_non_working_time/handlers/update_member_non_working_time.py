from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.member_non_working_time_facade import MemberNonWorkingTimeFacade
from ..schemas import MemberNonWorkingTimeUpdate, MemberNonWorkingTimeResponse


async def update_member_non_working_time_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    member_id: str,
    non_working_time_id: str,
    data: MemberNonWorkingTimeUpdate,
    confirm: bool,
    uow: UnitOfWork,
    actor_id: str,
) -> MemberNonWorkingTimeResponse:
    facade = MemberNonWorkingTimeFacade(uow)
    fields = {key: getattr(data, key) for key in data.model_fields_set}
    if "reason" in fields and fields["reason"] is not None:
        fields["reason"] = fields["reason"].value
    atomic, updated = await facade.update(
        member_id=member_id,
        non_working_time_id=non_working_time_id,
        changed=data.model_dump(mode="json", exclude_unset=True),
        **fields,
    )
    await emit(
        uow,
        "member_non_working_time_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return MemberNonWorkingTimeResponse.model_validate(updated)


TOOL = {
    "name": "update_member_non_working_time_handler",
    "permission": "write:member",
    "purpose": "멤버 비근무 시간을 수정한다.",
    "keywords": ["update member non working time", "휴가 수정", "비근무 시간 변경"],
    "boundaries": "비근무 시간 수정. 생성은 create_member_non_working_time_handler.",
    "output": "수정된 멤버 비근무 시간 (MemberNonWorkingTimeResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 멤버",
                "description": "대상 멤버의 UUID.",
            },
            "non_working_time_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 비근무 시간",
                "description": "수정할 비근무 시간의 UUID.",
            },
            "confirm": {
                "type": "boolean",
                "title": "충돌 강제 확정",
                "description": "충돌 시 강제 확정 여부.",
            },
            "start_time": {
                "anyOf": [{"format": "time", "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "시작 시각",
                "description": "비근무 시작 시각(미지정 시 유지).",
            },
            "end_time": {
                "anyOf": [{"format": "time", "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "종료 시각",
                "description": "비근무 종료 시각(미지정 시 유지).",
            },
            "effective_to": {
                "anyOf": [{"format": "date-time", "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "적용 종료",
                "description": "규칙 적용 종료 일시(미지정 시 유지).",
            },
            "reason": {
                "anyOf": [
                    {"$ref": "#/$defs/MemberNonWorkingTimeReason"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "사유: 연차/반차/병가 등(미지정 시 유지).",
            },
            "description": {
                "anyOf": [{"maxLength": 200, "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "상세 사유",
                "description": "상세 설명(미지정 시 유지).",
            },
        },
        "$defs": {
            "MemberNonWorkingTimeReason": {
                "enum": [
                    "ANNUAL_LEAVE",
                    "HALF_DAY_AM",
                    "HALF_DAY_PM",
                    "SICK_LEAVE",
                    "PERSONAL",
                    "TRAINING",
                    "BUSINESS_TRIP",
                    "OTHER",
                ],
                "title": "MemberNonWorkingTimeReason",
                "type": "string",
            }
        },
        "required": ["member_id", "non_working_time_id", "confirm"],
    },
}
