from ..schemas import CSMemoBulkDeleteResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.cs_memo.repository import CSMemoRepository
from app.modules.platform_admin.cs_memo.services.delete_memos import DeleteMemosService
from app.modules.platform_admin.auth.dependencies import SUPER_PLUS


async def delete_memos_handler(
    *,
    memo_ids: list[str],
    actor_id: str,
    actor_role: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> CSMemoBulkDeleteResponse:
    repo = uow.repo(CSMemoRepository)
    service = DeleteMemosService(repo)
    atomic, deleted_count = await service.execute(memo_ids=memo_ids, actor_id=actor_id, can_access_all=actor_role in SUPER_PLUS)

    await emit(
        uow,
        "cs_memo_bulk_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return CSMemoBulkDeleteResponse(detail=f"{deleted_count}개의 메모가 삭제되었습니다", deleted_count=deleted_count)


TOOL = {
    "name": "delete_memos_handler",
    "permission": None,
    "purpose": "CS 메모 여러 건을 일괄 삭제한다.",
    "keywords": ["메모 일괄 삭제", "CS 메모 삭제", "bulk delete memo"],
    "boundaries": "운영자 전용 — CS 메모 '일괄' 삭제. 단건은 delete_memo_handler.",
    "output": "일괄 삭제 결과 — 삭제 건수 (CSMemoBulkDeleteResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "memo_ids": {'type': 'array', 'items': {'type': 'string', 'format': 'uuid'}, 'title': '삭제할 메모 목록', 'description': '삭제할 CS 메모 UUID 목록.'},
        },
        "required": ["memo_ids"],
    },
}
