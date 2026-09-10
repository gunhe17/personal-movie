from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.cs_memo.repository import CSMemoRepository
from app.modules.platform_admin.cs_memo.schemas import CSMemoDetailResponse
from app.modules.platform_admin.cs_memo.services.get_memo import GetMemoService
from app.modules.platform_admin.auth.dependencies import SUPER_PLUS


async def get_memo_handler(
    memo_id: str,
    uow: UnitOfWork,
    *,
    actor_id: str,
    actor_role: str,
) -> CSMemoDetailResponse:
    repo = uow.repo(CSMemoRepository)
    service = GetMemoService(repo)
    memo = await service.execute(
        memo_id=memo_id, actor_id=actor_id, can_access_all=actor_role in SUPER_PLUS
    )
    response = CSMemoDetailResponse.model_validate(memo)
    names = await uow.repo(AdminAccountRepository).aggregate_name_map_by_ids(
        ids=[memo.created_by]
    )
    response.created_by_name = names.get(memo.created_by)
    return response


TOOL = {
    "name": "get_memo_handler",
    "permission": None,
    "purpose": "CS 메모 한 건을 조회한다.",
    "keywords": ["CS 메모 조회", "memo 상세"],
    "boundaries": "운영자 전용 — CS 메모 단건 조회(읽기). 목록은 list_memos_handler.",
    "output": "CS 메모 상세 (CSMemoDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "memo_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 메모",
                "description": "조회할 CS 메모의 UUID.",
            },
        },
        "required": ["memo_id"],
    },
}
