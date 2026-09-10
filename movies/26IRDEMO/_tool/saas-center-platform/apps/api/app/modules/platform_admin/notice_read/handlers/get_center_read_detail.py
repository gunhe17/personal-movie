from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.notice.repository import NoticeRepository
from app.modules.platform_admin.notice_read.repository import NoticeReadRepository
from app.modules.platform_admin.notice_read.schemas import (
    NoticeReadMemberDetail,
    NoticeReadCenterDetailResponse,
)
from app.modules.platform_admin.notice_read.services.get_center_read_detail import (
    GetCenterReadDetailService,
)


async def get_center_read_detail_handler(
    notice_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> NoticeReadCenterDetailResponse:
    notice_repo = uow.repo(NoticeRepository)
    read_repo = uow.repo(NoticeReadRepository)

    await notice_repo.get_active(notice_id)

    service = GetCenterReadDetailService(read_repo)
    center_name, rows = await service.execute(notice_id, center_id)

    members = [
        NoticeReadMemberDetail(
            member_id=row["member_id"],
            name=row["name"],
            role_name=row["role_name"],
            read_at=row["read_at"],
        )
        for row in rows
    ]

    return NoticeReadCenterDetailResponse(
        center_id=center_id,
        center_name=center_name,
        members=members,
    )


TOOL = {
    "name": "get_center_read_detail_handler",
    "permission": None,
    "purpose": "특정 공지에 대한 한 센터의 열람 상세를 조회한다.",
    "keywords": ["센터 열람 상세", "공지 읽음 상세", "read detail"],
    "boundaries": "운영자 전용 — 한 센터의 공지 열람 상세(읽기). 전체 현황은 get_read_status_handler.",
    "output": "센터별 공지 열람 상세 (NoticeReadCenterDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "notice_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 공지",
                "description": "공지의 UUID.",
            },
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "열람 상세를 볼 센터의 UUID.",
            },
        },
        "required": ["notice_id", "center_id"],
    },
}
