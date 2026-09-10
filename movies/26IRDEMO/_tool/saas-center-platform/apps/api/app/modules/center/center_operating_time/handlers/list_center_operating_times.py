from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.operating_time_facade import OperatingTimeFacade
from ..schemas import OperatingTimeSummary


async def list_center_operating_times_handler(
    center_id: str,
    uow: UnitOfWork,
) -> list[OperatingTimeSummary]:
    facade = OperatingTimeFacade(uow)
    result = await facade.list_with_response(center_id)
    return result


TOOL = {
    "name": "list_center_operating_times_handler",
    "permission": None,
    "purpose": "센터 운영시간 목록(요일별)을 조회한다.",
    "keywords": ["운영시간 목록", "영업시간 조회", "operating time 목록"],
    "boundaries": "운영시간 요일별 목록(읽기). 설정은 bulk_update_center_operating_times_handler.",
    "output": "요일별 운영시간 목록 (OperatingTimeSummary 배열).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
