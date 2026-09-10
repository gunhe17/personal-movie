from app.core.schemas import DetailResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.cs_memo.repository import CSMemoRepository
from app.modules.platform_admin.cs_memo.services.delete_memo import DeleteMemoService
from app.modules.platform_admin.auth.dependencies import SUPER_PLUS


async def delete_memo_handler(
    *,
    memo_id: str,
    actor_id: str,
    actor_role: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> DetailResponse:
    repo = uow.repo(CSMemoRepository)
    service = DeleteMemoService(repo)
    atomic, title = await service.execute(memo_id=memo_id, actor_id=actor_id, can_access_all=actor_role in SUPER_PLUS)

    await emit(
        uow,
        "cs_memo_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return DetailResponse(detail="삭제되었습니다")


TOOL = {
    "name": "delete_memo_handler",
    "permission": None,
    "purpose": "CS 메모를 삭제한다.",
    "keywords": ["CS 메모 삭제", "memo 삭제"],
    "boundaries": "운영자 전용 — CS 메모 단건 삭제. 일괄은 delete_memos_handler.",
    "output": "삭제 결과 메시지 (DetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "memo_id": {'type': 'string', 'format': 'uuid', 'title': '대상 메모', 'description': '삭제할 CS 메모의 UUID.'},
        },
        "required": ["memo_id"],
    },
}
