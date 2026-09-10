from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.center_application.repository import (
    AdminApplicationRepository,
)
from app.modules.platform_admin.center_application.schemas import (
    AdminApplicationListResponse,
)
from app.modules.platform_admin.center_application.services.list_applications import (
    ListApplicationsService,
)


async def list_admin_applications_handler(
    uow: UnitOfWork,
    *,
    status: str | None = None,
    search: str | None = None,
    page: int = 1,
    size: int = 20,
) -> AdminApplicationListResponse:
    repo = uow.repo(AdminApplicationRepository)
    service = ListApplicationsService(repo)
    items, total = await service.execute(
        status=status,
        search=search,
        page=page,
        size=size,
    )
    return AdminApplicationListResponse.build(
        items=items,
        total=total,
        page=page,
        size=size,
    )


TOOL = {
    "name": "list_admin_applications_handler",
    "permission": None,
    "purpose": "센터 개설 신청 목록을 운영자가 상태·검색으로 조회한다.",
    "keywords": ["센터 신청 목록", "개설 신청 조회", "admin applications"],
    "boundaries": "운영자 전용 — 센터 개설 신청 목록(읽기). 단건은 get_admin_application_handler.",
    "output": "센터 개설 신청 목록 (AdminApplicationListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "신청 상태 필터(pending/approved/rejected 등, 선택).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "센터명·신청자 검색어(선택).",
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
