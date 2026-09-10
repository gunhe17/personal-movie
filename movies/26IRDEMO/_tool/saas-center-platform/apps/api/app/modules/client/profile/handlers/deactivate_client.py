from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import ClientResponse
from ...facade.profile_facade import ProfileFacade


async def deactivate_client_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> ClientResponse:
    atomic, client = await ProfileFacade(uow).deactivate_client(center_id, client_id)
    await emit(
        uow,
        "client_deactivated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return ClientResponse.model_validate(client)


TOOL = {
    "name": "deactivate_client_handler",
    "permission": "write:client",
    "purpose": "내담자를 비활성 상태로 전환한다(상담 종료·졸업 처리).",
    "keywords": ["내담자 비활성화", "상담 종료", "졸업 처리", "deactivate client"],
    "boundaries": "활성 내담자를 '비활성화'. 재활성은 activate_client_handler, 보관은 archive_client_handler.",
    "output": "변경된 내담자 1건 (ClientResponse JSON).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {"type": "string", "format": "uuid", "title": "대상 내담자", "description": "대상 내담자의 고유 UUID."},
        },
        "required": ["client_id"],
    },
}
