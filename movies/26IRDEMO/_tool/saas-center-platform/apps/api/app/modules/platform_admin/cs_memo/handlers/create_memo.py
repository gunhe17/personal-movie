from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.cs_memo.repository import CSMemoRepository
from app.modules.platform_admin.cs_memo.schemas import CSMemoCreate, CSMemoDetailResponse
from app.modules.platform_admin.cs_memo.services.create_memo import CreateMemoService


async def create_memo_handler(
    *,
    data: CSMemoCreate,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> CSMemoDetailResponse:
    repo = uow.repo(CSMemoRepository)
    service = CreateMemoService(repo)
    atomic, memo = await service.execute(
        title=data.title,
        content=data.content,
        memo_type=data.memo_type.value,
        center_id=data.center_id,
        actor_id=actor_id,
    )
    response = CSMemoDetailResponse.model_validate(memo)
    names = await uow.repo(AdminAccountRepository).aggregate_name_map_by_ids(ids=[memo.created_by])
    response.created_by_name = names.get(memo.created_by)

    await emit(
        uow,
        "cs_memo_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return response


TOOL = {
    "name": 'create_memo_handler',
    "permission": None,
    "purpose": 'CS(고객지원) 메모를 작성한다.',
    "keywords": ['CS 메모 작성', '고객지원 메모', 'memo 생성'],
    "boundaries": '운영자 전용 — CS 메모 생성. 수정은 update_memo_handler.',
    "output": '생성된 CS 메모 상세 (CSMemoDetailResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'title': {'description': '메모 제목.', 'maxLength': 200, 'title': '제목', 'type': 'string'},
            'content': {'description': '메모 본문.', 'minLength': 1, 'title': '내용', 'type': 'string'},
            'memo_type': {'$ref': '#/$defs/MemoType', 'description': '유형: inquiry(문의)/complaint(불만)/request(요청)/other(기타).'},
            'center_id': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '관련 센터 UUID(선택).', 'title': '관련 센터'},
        },
        "$defs": {'MemoType': {'enum': ['inquiry', 'complaint', 'request', 'other'], 'title': 'MemoType', 'type': 'string'}},
        "required": ['title', 'content', 'memo_type'],
    },
}
