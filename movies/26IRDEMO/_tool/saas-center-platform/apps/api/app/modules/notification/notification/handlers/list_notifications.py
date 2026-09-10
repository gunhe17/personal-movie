from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade import NotificationFacade
from ..schemas import NotificationListResponse


async def list_notifications_handler(
    center_id: str,
    account_id: str,
    uow: UnitOfWork,
    *,
    category: str | None = None,
    is_read: bool | None = None,
    search: str | None = None,
    page: int = 1,
    size: int = 20,
    sort: str = "desc",
) -> NotificationListResponse:
    facade = NotificationFacade(uow)
    return await facade.list_with_response(
        center_id=center_id,
        recipient_id=account_id,
        category=category,
        is_read=is_read,
        search=search,
        page=page,
        size=size,
        sort=sort,
    )


TOOL = {
    "name": "list_notifications_handler",
    "permission": None,
    "purpose": "알림 목록을 분류·읽음여부·검색어로 거르고 페이지 단위로 조회한다.",
    "keywords": ["알림 목록", "알림 조회", "notification 목록", "알림함"],
    "boundaries": "알림 목록(읽기). 미읽음 수는 get_unread_count_handler, 읽음 처리는 mark_as_read_handler.",
    "output": "알림 목록 (NotificationListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "title": "분류 필터",
                "enum": ["assessment", "counseling", "system"],
                "description": "알림 대분류 필터(선택).",
            },
            "is_read": {
                "type": "boolean",
                "title": "읽음 여부 필터",
                "description": "읽음 여부 필터(선택).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "제목·본문 부분일치 검색(선택).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": ["asc", "desc"],
                "description": "생성일 정렬. 기본 desc(최신순).",
            },
        },
        "required": [],
    },
}
