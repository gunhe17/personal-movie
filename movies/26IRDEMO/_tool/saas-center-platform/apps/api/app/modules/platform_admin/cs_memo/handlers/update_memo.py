from app.core.type import unset
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.cs_memo.repository import CSMemoRepository
from app.modules.platform_admin.cs_memo.schemas import CSMemoUpdate, CSMemoDetailResponse
from app.modules.platform_admin.cs_memo.services.update_memo import UpdateMemoService
from app.modules.platform_admin.auth.dependencies import SUPER_PLUS


async def update_memo_handler(
    *,
    memo_id: str,
    data: CSMemoUpdate,
    actor_id: str,
    actor_role: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> CSMemoDetailResponse:
    repo = uow.repo(CSMemoRepository)
    update_data = data.model_dump(exclude_unset=True)
    if "memo_type" in update_data and update_data["memo_type"] is not None:
        update_data["memo_type"] = update_data["memo_type"].value

    service = UpdateMemoService(repo)
    atomic, memo = await service.execute(
        memo_id=memo_id,
        actor_id=actor_id,
        can_access_all=actor_role in SUPER_PLUS,
        title=update_data.get("title", unset),
        content=update_data.get("content", unset),
        memo_type=update_data.get("memo_type", unset),
        center_id=update_data.get("center_id", unset),
    )
    response = CSMemoDetailResponse.model_validate(memo)
    names = await uow.repo(AdminAccountRepository).aggregate_name_map_by_ids(ids=[memo.created_by])
    response.created_by_name = names.get(memo.created_by)

    await emit(
        uow,
        "cs_memo_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return response


TOOL = {
    "name": 'update_memo_handler',
    "permission": None,
    "purpose": 'CS 메모를 수정한다.',
    "keywords": ['CS 메모 수정', 'memo 편집'],
    "boundaries": '운영자 전용 — CS 메모 수정. 생성은 create_memo_handler.',
    "output": '수정된 CS 메모 상세 (CSMemoDetailResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'memo_id': {'type': 'string', 'format': 'uuid', 'title': '대상 메모', 'description': '수정할 CS 메모의 UUID.'},
            'title': {'anyOf': [{'maxLength': 200, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '제목(미지정 시 유지).', 'title': '제목'},
            'content': {'anyOf': [{'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '내용(미지정 시 유지).', 'title': '내용'},
            'memo_type': {'anyOf': [{'$ref': '#/$defs/MemoType'}, {'type': 'null'}], 'default': None, 'description': '유형(미지정 시 유지).'},
            'center_id': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '관련 센터 UUID(미지정 시 유지).', 'title': '관련 센터'},
        },
        "$defs": {'MemoType': {'enum': ['inquiry', 'complaint', 'request', 'other'], 'title': 'MemoType', 'type': 'string'}},
        "required": ['memo_id'],
    },
}
