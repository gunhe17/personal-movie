from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.notice.notice.schemas import NoticeDetailResponse
from app.modules.platform_admin.notice.repository import NoticeRepository
from app.modules.platform_admin.notice.services.get_notice import GetNoticeService


async def get_admin_notice_handler(
    notice_id: str,
    uow: UnitOfWork,
) -> NoticeDetailResponse:
    repo = uow.repo(NoticeRepository)
    service = GetNoticeService(repo)
    notice = await service.execute(notice_id)
    return NoticeDetailResponse.model_validate(notice)


TOOL = {
    "name": "get_admin_notice_handler",
    "permission": None,
    "purpose": "운영자용 공지 상세를 조회한다.",
    "keywords": ["공지 조회", "공지사항 상세", "admin notice 조회"],
    "boundaries": "운영자 전용 — 공지 상세(읽기). 목록은 list_admin_notices_handler.",
    "output": "공지 상세 (NoticeDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "notice_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 공지",
                "description": "조회할 공지의 UUID.",
            },
        },
        "required": ["notice_id"],
    },
}
