from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.center.repository import AdminCenterClientRepository
from app.modules.platform_admin.center.schemas import AdminCenterClientListResponse
from app.modules.platform_admin.center.services.list_center_clients import (
    ListCenterClientsService,
)


async def list_center_clients_handler(
    center_id: str,
    uow: UnitOfWork,
    *,
    status: str | None = None,
    page: int = 1,
    size: int = 10,
) -> AdminCenterClientListResponse:
    repo = uow.repo(AdminCenterClientRepository)
    service = ListCenterClientsService(repo)
    items, stats, total = await service.execute(
        center_id=center_id,
        status=status,
        page=page,
        size=size,
    )
    return AdminCenterClientListResponse.build(
        items=items,
        stats=stats,
        total=total,
        page=page,
        size=size,
    )


TOOL = {
    "name": "list_center_clients_handler",
    "permission": None,
    "purpose": "센터의 내담자 목록을 운영자가 조회한다.",
    "keywords": ["센터 내담자 목록", "어드민 고객 조회", "center clients"],
    "boundaries": "운영자 전용 — 특정 센터의 내담자 목록(읽기).",
    "output": "센터 내담자 목록 (AdminCenterClientListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "내담자를 조회할 센터의 UUID.",
            },
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "내담자 상태 필터(선택).",
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
        "required": ["center_id"],
    },
}
