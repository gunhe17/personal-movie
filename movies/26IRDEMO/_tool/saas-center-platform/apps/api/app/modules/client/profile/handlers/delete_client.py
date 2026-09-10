from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import ClientResponse
from ...facade.profile_facade import ProfileFacade


async def delete_client_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> ClientResponse:
    client_atomic, client = await ProfileFacade(uow).delete_client(center_id, client_id)
    await emit(
        uow,
        "client_deleted",
        event_group_id=event_group_id,
        atomics=[client_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return ClientResponse.model_validate(client)


TOOL = {
    "name": "delete_client_handler",
    "permission": "delete:client",
    "purpose": "내담자를 삭제한다.",
    "keywords": ['delete client', "내담자 삭제", "고객 제거", "client 삭제"],
    "boundaries": "내담자 삭제. 상태 전환은 activate/deactivate/archive_client_handler.",
    "output": "삭제된 내담자 (ClientResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {"type": "string", "format": "uuid", "title": "대상 내담자",
                          "description": "삭제할 내담자의 UUID."},
        },
        "required": ["client_id"],
    },
}
