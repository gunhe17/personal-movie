from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import CounselingCaseFacade


async def leave_participant_handler(
    *,
    event_group_id: uuid_str,
    case_id: str,
    participant_id: str,
    center_id: str,
    owner_scope: str | None,
    uow: UnitOfWork,
    actor_id: str | None = None,
) -> None:
    facade = CounselingCaseFacade(uow)
    atomics, _ = await facade.leave_participant(
        case_id=case_id,
        participant_id=participant_id,
        center_id=center_id,
        counselor_id=owner_scope,
    )
    await emit(
        uow,
        "counseling_case_participant_left",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "leave_participant_handler",
    "permission": "write:counseling",
    "purpose": "상담 케이스 참여에서 빠진다.",
    "keywords": ["케이스 떠나기", "참여 종료", "leave participant"],
    "boundaries": "케이스 참여자가 '나간다'. 추가는 add_counseling_participant_handler.",
    "output": "없음 (참여 종료).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "참여에서 나갈 상담 케이스의 UUID.",
            },
            "participant_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 참여자",
                "description": "나갈 참여자의 UUID.",
            },
        },
        "required": ["case_id", "participant_id"],
    },
}
