from app.core.schemas import OkResponse
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..._audit import emit_admin_audit
from ...facade import SampleFacade


async def delete_sample_handler(
    sample_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> OkResponse:
    await SampleFacade(uow).delete_sample(sample_id)
    await emit_admin_audit(
        uow, "sample_dataset_deleted",
        act="deleted", entity_name="sample_dataset", entity_id=sample_id,
        event_group_id=event_group_id, actor_id=actor_id, ip=ip,
    )
    return OkResponse(ok=True)


TOOL = {
    "name": "delete_sample_handler",
    "permission": None,
    "purpose": "샘플 데이터를 삭제한다.",
    "keywords": ["샘플 삭제", "sample 삭제", "데이터 제거"],
    "boundaries": "샘플 삭제. 조회는 get_sample_handler.",
    "output": "삭제 결과 (OkResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "sample_id": {"type": "string", "format": "uuid", "title": "대상 샘플", "description": "삭제할 샘플의 UUID."},
        },
        "required": ["sample_id"],
    },
}
