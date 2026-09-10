from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.counseling_session_facade import CounselingSessionFacade
from ...counseling_session_participant.schemas import (
    SessionParticipantUpdate,
    SessionParticipantResponse,
)


async def update_attendance_handler(
    *,
    event_group_id: uuid_str,
    session_participant_id: str,
    center_id: str,
    member_id: str,
    data: SessionParticipantUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> SessionParticipantResponse:
    facade = CounselingSessionFacade(uow)
    fields = {key: getattr(data, key) for key in data.model_fields_set}
    if "attendance_status" in fields and fields["attendance_status"] is not None:
        fields["attendance_status"] = fields["attendance_status"].value
    atomic, participant = await facade.update_participant_by_id(
        session_participant_id=session_participant_id,
        center_id=center_id,
        counselor_id=member_id,
        changed=data.model_dump(mode="json", exclude_unset=True),
        **fields,
    )
    await emit(
        uow,
        "counseling_session_participant_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return SessionParticipantResponse.model_validate(participant)


TOOL = {
    "name": "update_attendance_handler",
    "permission": "write:counseling",
    "purpose": "회기 참여자의 출결 상태를 변경한다.",
    "keywords": [
        "update attendance",
        "출결 변경",
        "출석 처리",
        "attendance",
        "결석 체크",
    ],
    "boundaries": "회기 참여자의 '출결' 갱신. 참여자 추가/제거는 add_participants·remove_counseling_participant_handler.",
    "output": "출결이 갱신된 회기 참여자 (SessionParticipantResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_participant_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 회기 참여자",
                "description": "출결을 변경할 회기 참여자의 UUID.",
            },
            "attendance_status": {
                "anyOf": [{"$ref": "#/$defs/AttendanceStatus"}, {"type": "null"}],
                "default": None,
                "description": "출석 상태: scheduled/attended/absent/late/excused/no_show(미지정 시 유지).",
            },
            "is_consumed": {
                "anyOf": [{"type": "boolean"}, {"type": "null"}],
                "default": None,
                "description": "회기 소진(차감) 여부(미지정 시 유지).",
                "title": "회기 소진",
            },
            "memo": {
                "anyOf": [{"maxLength": 500, "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "출석 메모(미지정 시 유지).",
                "title": "출석 메모",
            },
        },
        "$defs": {
            "AttendanceStatus": {
                "description": "참석 상태\n\n- scheduled: 예정 (Session 생성 시 기본값)\n- attended: 참석 (실제 참석 완료)\n- absent: 불참 (사전 통보된 결석)\n- late: 지각\n- excused: 사전 결석 (사유 있는 결석)\n- no_show: 노쇼 (무단 결석) — 청구 정책상 absent와 구분",
                "enum": [
                    "scheduled",
                    "attended",
                    "absent",
                    "late",
                    "excused",
                    "no_show",
                ],
                "title": "AttendanceStatus",
                "type": "string",
            }
        },
        "required": ["session_participant_id"],
    },
}
