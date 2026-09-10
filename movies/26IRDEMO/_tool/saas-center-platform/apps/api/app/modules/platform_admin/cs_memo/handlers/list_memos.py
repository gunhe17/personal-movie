from datetime import date

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.cs_memo.repository import CSMemoRepository
from app.modules.platform_admin.cs_memo.schemas import CSMemoSummary, CSMemoListResponse
from app.modules.platform_admin.cs_memo.services.list_memos import ListMemosService
from app.modules.platform_admin.auth.dependencies import SUPER_PLUS


async def list_memos_handler(
    uow: UnitOfWork,
    *,
    actor_id: str,
    actor_role: str,
    search: str | None = None,
    memo_type: str | None = None,
    center_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort_order: str = "desc",
    page: int = 1,
    size: int = 20,
) -> CSMemoListResponse:
    repo = uow.repo(CSMemoRepository)
    service = ListMemosService(repo)
    rows, meta = await service.execute(
        actor_id=actor_id,
        can_access_all=actor_role in SUPER_PLUS,
        search=search,
        memo_type=memo_type,
        center_id=center_id,
        date_from=date_from,
        date_to=date_to,
        sort_order=sort_order,
        page=page,
        size=size,
    )
    items = [CSMemoSummary.model_validate(memo) for memo in rows]
    names = await uow.repo(AdminAccountRepository).aggregate_name_map_by_ids(
        ids=[m.created_by for m in rows]
    )
    for item, memo in zip(items, rows):
        item.created_by_name = names.get(memo.created_by)
    return CSMemoListResponse.build(
        items=items, total=meta["total"], page=page, size=size
    )


TOOL = {
    "name": "list_memos_handler",
    "permission": None,
    "purpose": "CS 메모 목록을 검색·유형·기간으로 거르고 조회한다.",
    "keywords": ["CS 메모 목록", "고객지원 메모 조회", "memo 리스트"],
    "boundaries": "운영자 전용 — CS 메모 목록(읽기). 단건은 get_memo_handler.",
    "output": "CS 메모 목록 (CSMemoListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "제목·내용 검색어(선택).",
            },
            "memo_type": {
                "type": "string",
                "title": "유형 필터",
                "description": "유형 필터(inquiry/complaint/request/other, 선택).",
            },
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "센터 필터",
                "description": "관련 센터로 필터(선택).",
            },
            "date_from": {
                "type": "string",
                "format": "date",
                "title": "시작일",
                "description": "조회 시작일(선택).",
            },
            "date_to": {
                "type": "string",
                "format": "date",
                "title": "종료일",
                "description": "조회 종료일(선택).",
            },
            "sort_order": {
                "type": "string",
                "title": "정렬",
                "description": "정렬 순서(기본 desc).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": [],
    },
}
