from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.non_operating_time_facade import NonOperatingTimeFacade
from ..schemas import NonOperatingTimeResponse


async def get_center_non_operating_time_handler(
    center_id: str,
    non_operating_time_id: str,
    uow: UnitOfWork,
) -> NonOperatingTimeResponse:
    facade = NonOperatingTimeFacade(uow)
    result = await facade.get_with_response(center_id, non_operating_time_id)
    return result


TOOL = {
    "name": "get_center_non_operating_time_handler",
    "permission": None,
    "purpose": "센터 비운영 시간 한 건을 조회한다.",
    "keywords": ["휴무 조회", "비운영 시간 상세"],
    "boundaries": "단건 비운영 시간 조회(읽기). 목록은 list_center_non_operating_times_handler.",
    "output": "센터 비운영 시간 상세 (NonOperatingTimeResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "non_operating_time_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 비운영 시간",
                "description": "조회할 비운영 시간의 UUID.",
            },
        },
        "required": ["non_operating_time_id"],
    },
}
