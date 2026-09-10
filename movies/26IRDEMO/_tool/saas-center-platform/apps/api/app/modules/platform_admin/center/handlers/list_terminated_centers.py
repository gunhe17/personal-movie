from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.center.repository import AdminCenterRepository
from app.modules.platform_admin.center.services.list_terminated_centers import (
    ListTerminatedCentersService,
)
from app.modules.platform_admin.center.schemas import TerminatedCenterListResponse


async def list_terminated_centers_handler(
    uow: UnitOfWork,
    *,
    status: str | None = None,
    search: str | None = None,
    expiring_soon: bool = False,
    page: int = 1,
    size: int = 20,
) -> TerminatedCenterListResponse:
    repo = uow.repo(AdminCenterRepository)
    service = ListTerminatedCentersService(repo)
    items, total = await service.execute(
        status=status,
        search=search,
        expiring_soon=expiring_soon,
        page=page,
        size=size,
    )
    return TerminatedCenterListResponse.build(
        items=items,
        total=total,
        page=page,
        size=size,
    )


TOOL = {
    "name": "list_terminated_centers_handler",
    "permission": None,
    "purpose": "종료된 센터 목록을 조회한다.",
    "keywords": ["종료 센터 목록", "폐쇄 센터", "terminated centers"],
    "boundaries": "운영자 전용 — '종료' 센터 목록(읽기, 만료임박 필터). 일반 목록은 list_admin_centers_handler.",
    "output": "종료된 센터 목록 (TerminatedCenterListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "상태 필터(선택).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "센터명 검색어(선택).",
            },
            "expiring_soon": {
                "type": "boolean",
                "title": "만료 임박 필터",
                "description": "데이터 보관 만료 임박 건만 필터.",
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
