import math

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.notice.repository import NoticeRepository
from app.modules.platform_admin.notice_read.repository import NoticeReadRepository
from app.modules.platform_admin.notice_read.schemas import (
    NoticeReadCenterSummary,
    NoticeReadStatusResponse,
)
from app.modules.platform_admin.notice_read.services.get_read_status import (
    GetReadStatusService,
)
from app.modules.platform_admin.audit_log.repository import AdminAuditReadRepository


async def get_read_status_handler(
    notice_id: str,
    uow: UnitOfWork,
    *,
    search: str | None = None,
    is_read: bool | None = None,
    page: int = 1,
    size: int = 10,
) -> NoticeReadStatusResponse:
    notice_repo = uow.repo(NoticeRepository)
    read_repo = uow.repo(NoticeReadRepository)

    await notice_repo.get_active(notice_id)

    service = GetReadStatusService(read_repo)
    rows, total = await service.execute(
        notice_id,
        search=search,
        is_read=is_read,
        page=page,
        size=size,
    )

    # 마지막 리마인드 발송 시각 (쿨다운 UI용) — event outbox 기반
    last_atomic = await uow.repo(AdminAuditReadRepository).find_last_admin_atomic(
        entity_name="notice",
        acts=["reminded", "notify_remind", "notify_remind_center"],
        entity_id=notice_id,
    )
    last_notified_at = last_atomic.created_at if last_atomic else None

    centers = [
        NoticeReadCenterSummary(
            center_id=row["center_id"],
            center_name=row["center_name"],
            is_read=row["read_count"] > 0,
            first_read_at=row["first_read_at"],
            read_count=row["read_count"],
            member_count=row["member_count"],
        )
        for row in rows
    ]

    read_centers = sum(1 for c in centers if c.is_read)

    return NoticeReadStatusResponse(
        total_centers=total,
        read_centers=read_centers,
        unread_centers=total - read_centers,
        last_notified_at=last_notified_at,
        centers=centers,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 1,
    )


TOOL = {
    "name": "get_read_status_handler",
    "permission": None,
    "purpose": "공지의 센터별 열람 현황을 조회한다.",
    "keywords": ["공지 열람 현황", "읽음 상태", "read status"],
    "boundaries": "운영자 전용 — 공지의 센터별 열람 현황(읽기). 한 센터 상세는 get_center_read_detail_handler.",
    "output": "공지 센터별 열람 현황 (NoticeReadStatusResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "notice_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 공지",
                "description": "열람 현황을 볼 공지의 UUID.",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "센터명 검색어(선택).",
            },
            "is_read": {
                "type": "boolean",
                "title": "읽음 여부 필터",
                "description": "읽음/안읽음 필터(선택).",
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
        "required": ["notice_id"],
    },
}
