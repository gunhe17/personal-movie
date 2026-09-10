from app.core.schemas import MessageResponse
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from ..repository import PersonRepository
from ..services.delete_person import DeletePersonService


async def delete_person_handler(
    person_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> MessageResponse:
    person_atomic, _person = await DeletePersonService(uow.repo(PersonRepository)).execute(
        person_id,
    )
    await emit(
        uow,
        "person_deleted",
        event_group_id=event_group_id,
        atomics=[person_atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return MessageResponse(message="Person이 삭제되었습니다")


TOOL = {
    "name": "delete_person_handler",
    "permission": None,
    "purpose": "개인 정보를 삭제한다.",
    "keywords": ["개인 삭제", "person 삭제", "인물 제거"],
    "boundaries": "개인 정보 삭제. 조회는 get_person_handler.",
    "output": "삭제 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "person_id": {"type": "string", "format": "uuid", "title": "대상 개인", "description": "삭제할 개인의 UUID."},
        },
        "required": ["person_id"],
    },
}
