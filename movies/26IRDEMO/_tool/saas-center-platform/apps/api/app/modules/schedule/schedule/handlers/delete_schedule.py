from app.core.schemas import MessageResponse
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import ScheduleFacade


async def delete_schedule_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    schedule_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> MessageResponse:
    schedule_atomic, _ = await ScheduleFacade(uow).delete_schedule(
        center_id=center_id,
        schedule_id=schedule_id,
    )
    await emit(
        uow,
        "schedule_deleted",
        event_group_id=event_group_id,
        atomics=[schedule_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return MessageResponse(message="일정이 삭제되었습니다")


TOOL = {
    "name": "delete_schedule_handler",
    "permission": "delete:schedule",
    "purpose": "일정을 삭제한다.",
    "keywords": ['delete schedule', "일정 삭제", "스케줄 삭제", "schedule 삭제", "예약 삭제"],
    "boundaries": "일정 삭제. 생성/수정은 create_schedule_handler·update_schedule_handler.",
    "output": "삭제 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "schedule_id": {"type": "string", "format": "uuid", "title": "대상 일정",
                            "description": "삭제할 일정의 UUID."},
        },
        "required": ["schedule_id"],
    },
}
