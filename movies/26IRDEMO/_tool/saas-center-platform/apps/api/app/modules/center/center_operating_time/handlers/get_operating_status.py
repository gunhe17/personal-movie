from datetime import date

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.operating_time_facade import OperatingTimeFacade
from ..schemas import OperatingStatusSlotsResponse, OperatingStatusSlotResponse


async def get_operating_status_handler(
    center_id: str,
    date: date,
    slot: str | None,
    uow: UnitOfWork,
) -> OperatingStatusSlotsResponse | OperatingStatusSlotResponse:
    facade = OperatingTimeFacade(uow)
    if slot:
        return await facade.get_operating_status_with_response(center_id, date, slot)
    else:
        return await facade.list_available_slots_with_response(center_id, date)


TOOL = {
    "name": "get_operating_status_handler",
    "permission": None,
    "purpose": "특정 날짜·슬롯의 센터 운영 상태를 조회한다.",
    "keywords": ["운영 상태", "영업 여부", "operating status", "오픈 여부"],
    "boundaries": "날짜/슬롯의 운영 상태(읽기). 운영시간 설정은 bulk_update_center_operating_times_handler.",
    "output": "운영 상태 — slot 지정 시 단일, 미지정 시 전체 슬롯 (OperatingStatusSlot(s)Response).",
    "input_schema": {
        "type": "object",
        "properties": {
            "date": {
                "type": "string",
                "format": "date",
                "title": "확인 날짜",
                "description": "운영 상태를 확인할 날짜.",
            },
            "slot": {
                "type": "string",
                "title": "시간 슬롯",
                "description": "확인할 시간 슬롯(선택, 없으면 전체 슬롯).",
            },
        },
        "required": ["date"],
    },
}
