from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import ClientResponse
from ...facade.profile_facade import ProfileFacade


async def archive_client_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> ClientResponse:
    atomic, client = await ProfileFacade(uow).archive_client(center_id, client_id)
    await emit(
        uow,
        "client_archived",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return ClientResponse.model_validate(client)


TOOL = {
    "name": "archive_client_handler",
    "permission": "write:client",
    "purpose": "비활성 내담자를 보관 상태로 전환한다.",
    "keywords": ["내담자 보관", "아카이브", "archive client"],
    "boundaries": "비활성 내담자를 '보관'. 복원은 activate_client_handler.",
    "output": "변경된 내담자 1건 (ClientResponse JSON).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {"type": "string", "format": "uuid", "title": "대상 내담자", "description": "대상 내담자의 고유 UUID."},
        },
        "required": ["client_id"],
    },
}
