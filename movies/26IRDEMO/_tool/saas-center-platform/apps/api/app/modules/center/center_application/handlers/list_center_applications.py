from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import CenterApplicationListResponse


async def list_center_applications_handler(
    status_filter: str | None,
    skip: int,
    limit: int,
    uow: UnitOfWork,
) -> CenterApplicationListResponse:
    from app.modules.center.facade import CenterApplicationFacade

    facade = CenterApplicationFacade(uow)
    result = await facade.list_applications_with_response(
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )
    return result


TOOL = {
    "name": "list_center_applications_handler",
    "permission": None,
    "purpose": "센터 개설 신청 목록을 상태로 거르고 조회한다.",
    "keywords": ["센터 신청 목록", "개설 신청 조회", "application 목록"],
    "boundaries": "신청 목록(읽기). 단건은 get_center_application_handler.",
    "output": "센터 개설 신청 목록 (CenterApplicationListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status_filter": {
                "type": "string",
                "title": "상태 필터",
                "description": "신청 상태 필터(선택).",
            },
            "skip": {
                "type": "integer",
                "title": "오프셋",
                "description": "건너뛸 개수.",
            },
            "limit": {
                "type": "integer",
                "title": "최대 개수",
                "description": "가져올 최대 개수.",
            },
        },
        "required": ["skip", "limit"],
    },
}
