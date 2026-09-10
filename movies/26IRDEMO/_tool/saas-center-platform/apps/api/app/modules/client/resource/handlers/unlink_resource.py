# form-instance와 document 모두 동일한 unlink 로직을 사용.
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.client.facade.resource_facade import ResourceFacade


async def unlink_resource_handler(
    mapping_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> None:
    facade = ResourceFacade(uow)
    atomic, _resource = await facade.unlink_resource(mapping_id, center_id)
    await emit(
        uow,
        "client_resource_unlinked",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "unlink_resource_handler",
    "permission": None,
    "agent_exposed": False,  # 권한이 resource_type에 따라 갈림(delete:form_instance/delete:document) — 단일 코드 불가
    "purpose": "내담자에 연결된 자원(문서/폼 등)을 연결 해제한다.",
    "keywords": ["자원 연결 해제", "리소스 분리", "unlink resource"],
    "boundaries": "내담자-자원 연결을 '해제'한다.",
    "output": "없음 (해제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "mapping_id": {"type": "string", "format": "uuid", "title": "대상 자원 연결",
                           "description": "해제할 자원 연결의 UUID."},
        },
        "required": ["mapping_id"],
    },
}
