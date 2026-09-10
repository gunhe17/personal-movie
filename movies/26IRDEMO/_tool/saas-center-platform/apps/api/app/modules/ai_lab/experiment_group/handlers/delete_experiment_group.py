from app.core.schemas import OkResponse
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from ...facade import ExperimentGroupFacade


async def delete_experiment_group_handler(
    group_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> OkResponse:
    atomic, _ = await ExperimentGroupFacade(uow).delete_experiment_group(group_id)
    await emit(
        uow,
        "experiment_group_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )
    return OkResponse(ok=True)


TOOL = {
    "name": "delete_experiment_group_handler",
    "permission": None,
    "purpose": "AI 실험 그룹을 삭제한다.",
    "keywords": ["실험 그룹 삭제", "group 삭제", "실험 묶음 제거"],
    "boundaries": "실험 그룹을 삭제한다. 조회는 get_experiment_group_handler.",
    "output": "삭제 결과 (OkResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "group_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 실험 그룹",
                "description": "삭제할 실험 그룹의 UUID.",
            },
        },
        "required": ["group_id"],
    },
}
