from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.non_operating_time_facade import NonOperatingTimeFacade
from ..schemas import NonOperatingTimeResponse


async def list_center_non_operating_times_handler(
    center_id: str,
    skip: int,
    limit: int,
    active_only: bool,
    uow: UnitOfWork,
) -> list[NonOperatingTimeResponse]:
    facade = NonOperatingTimeFacade(uow)
    result = await facade.list_with_response(center_id, skip, limit, active_only)
    return result


TOOL = {
    "name": "list_center_non_operating_times_handler",
    "permission": None,
    "purpose": "센터 비운영 시간 목록을 조회한다.",
    "keywords": ["휴무 목록", "비운영 시간 목록", "센터 휴일 목록"],
    "boundaries": "비운영 시간 목록(읽기). 단건은 get_center_non_operating_time_handler.",
    "output": "센터 비운영 시간 목록 (NonOperatingTimeResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
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
            "active_only": {
                "type": "boolean",
                "title": "활성만",
                "description": "활성 항목만 볼지 여부.",
            },
        },
        "required": ["skip", "limit", "active_only"],
    },
}
