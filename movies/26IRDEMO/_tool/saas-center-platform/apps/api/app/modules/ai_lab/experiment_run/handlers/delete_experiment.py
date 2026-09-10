from app.core.schemas import OkResponse
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..._audit import emit_admin_audit
from ...facade import ExperimentFacade


async def delete_experiment_handler(
    experiment_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> OkResponse:
    await ExperimentFacade(uow).delete_experiment(experiment_id)
    await emit_admin_audit(
        uow, "experiment_run_deleted",
        act="deleted", entity_name="experiment_run", entity_id=experiment_id,
        event_group_id=event_group_id, actor_id=actor_id, ip=ip,
    )
    return OkResponse(ok=True)


TOOL = {
    "name": "delete_experiment_handler",
    "permission": None,
    "purpose": "AI 실험 실행 기록을 삭제한다.",
    "keywords": ["실험 삭제", "experiment 삭제", "실행 기록 제거"],
    "boundaries": "실험 단건 삭제. 조회는 get_experiment_handler.",
    "output": "삭제 결과 (OkResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "experiment_id": {"type": "string", "format": "uuid", "title": "대상 실험", "description": "삭제할 실험의 UUID."},
        },
        "required": ["experiment_id"],
    },
}
