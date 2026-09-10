from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import ClientResponse
from ...facade.profile_facade import ProfileFacade


async def activate_client_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> ClientResponse:
    atomic, client = await ProfileFacade(uow).activate_client(center_id, client_id)
    await emit(
        uow,
        "client_activated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return ClientResponse.model_validate(client)


TOOL = {
    "name": "activate_client_handler",
    "permission": "write:client",
    "purpose": "내담자를 활성 상태로 전환한다(비활성·보관에서 복원).",
    "keywords": ["내담자 활성화", "재활성", "복원", "activate client"],
    "boundaries": "비활성/보관 내담자를 '활성화'. 비활성화는 deactivate_client_handler, 보관은 archive_client_handler.",
    "output": "변경된 내담자 1건 (ClientResponse JSON).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {"type": "string", "format": "uuid", "title": "대상 내담자", "description": "대상 내담자의 고유 UUID."},
        },
        "required": ["client_id"],
    },
}
