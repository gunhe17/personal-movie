from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.notice.repository import NoticeRepository
from app.modules.platform_admin.notice.schemas import (
    AdminNoticeSummary,
    AdminNoticeListResponse,
)
from app.modules.platform_admin.notice.services.list_notices import ListNoticesService


async def list_admin_notices_handler(
    uow: UnitOfWork,
    *,
    category: str | None = None,
    is_published: bool | None = None,
    search: str | None = None,
    sort_order: str = "desc",
    page: int = 1,
    size: int = 20,
) -> AdminNoticeListResponse:
    repo = uow.repo(NoticeRepository)
    service = ListNoticesService(repo)
    rows, read_counts, target_count, page_meta = await service.execute(
        category=category,
        is_published=is_published,
        search=search,
        sort_order=sort_order,
        page=page,
        size=size,
    )

    items = []
    for notice in rows:
        item = AdminNoticeSummary.model_validate(notice)
        item.read_count = read_counts.get(notice.id, 0)
        item.target_read_count = target_count
        items.append(item)

    return AdminNoticeListResponse.build(
        items=items,
        total=page_meta["total"],
        page=page_meta["page"],
        size=page_meta["size"],
    )


TOOL = {
    "name": "list_admin_notices_handler",
    "permission": None,
    "purpose": "운영자용 공지 목록을 분류·게시여부·검색으로 조회한다.",
    "keywords": ["공지 목록", "공지사항 조회", "admin notices"],
    "boundaries": "운영자 전용 — 공지 목록(읽기). 단건은 get_admin_notice_handler.",
    "output": "공지 목록 (AdminNoticeListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "title": "분류 필터",
                "description": "분류 필터(maintenance/update/announcement, 선택).",
            },
            "is_published": {
                "type": "boolean",
                "title": "게시 여부 필터",
                "description": "게시 여부 필터(선택).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "제목·내용 검색어(선택).",
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
