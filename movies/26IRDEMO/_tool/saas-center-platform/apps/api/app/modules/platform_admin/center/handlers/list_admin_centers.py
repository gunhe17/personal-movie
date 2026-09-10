from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.center.repository import AdminCenterRepository
from app.modules.platform_admin.center.schemas import AdminCenterListResponse
from app.modules.platform_admin.center.services.list_centers import ListCentersService


async def list_admin_centers_handler(
    uow: UnitOfWork,
    *,
    status: str | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    page: int = 1,
    size: int = 20,
) -> AdminCenterListResponse:
    repo = uow.repo(AdminCenterRepository)
    service = ListCentersService(repo)
    items, total = await service.execute(
        status=status,
        search=search,
        sort_by=sort_by,
        page=page,
        size=size,
    )
    return AdminCenterListResponse.build(
        items=items,
        total=total,
        page=page,
        size=size,
    )


TOOL = {
    "name": "list_admin_centers_handler",
    "permission": None,
    "purpose": "센터 목록을 운영자가 상태·검색·정렬로 조회한다.",
    "keywords": ["어드민 센터 목록", "센터 관리 리스트", "admin centers"],
    "boundaries": "운영자 전용 — 센터 목록(읽기). 종료 센터는 list_terminated_centers_handler, 단건은 get_admin_center_handler.",
    "output": "센터 목록 (AdminCenterListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "센터 상태 필터(선택).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "센터명 검색어(선택).",
            },
            "sort_by": {
                "type": "string",
                "title": "정렬 기준",
                "description": "정렬 기준(기본 created_at).",
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
