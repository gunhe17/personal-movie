from datetime import date

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.member_working_time_facade import MemberWorkingTimeFacade
from ..schemas import WorkingStatusSlotsResponse, WorkingStatusSlotResponse


async def get_working_status_handler(
    center_id: str,
    member_id: str,
    date: date,
    slot: str | None,
    uow: UnitOfWork,
) -> WorkingStatusSlotsResponse | WorkingStatusSlotResponse:
    facade = MemberWorkingTimeFacade(uow)

    if slot:
        result = await facade.get_working_status_with_response(
            center_id, member_id, date, slot
        )
    else:
        result = await facade.list_available_slots_with_response(
            center_id, member_id, date
        )
    return result


TOOL = {
    "name": "get_working_status_handler",
    "permission": None,
    "purpose": "특정 날짜·슬롯의 멤버 근무 상태를 조회한다.",
    "keywords": ["근무 상태", "근무 여부", "working status"],
    "boundaries": "날짜/슬롯의 멤버 근무 상태(읽기). 설정은 bulk_update_member_working_times_handler.",
    "output": "멤버 근무 상태 — slot 지정 시 단일, 미지정 시 전체 슬롯 (WorkingStatusSlot(s)Response).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 멤버",
                "description": "근무 상태를 확인할 멤버의 UUID.",
            },
            "date": {
                "type": "string",
                "format": "date",
                "title": "확인 날짜",
                "description": "확인할 날짜.",
            },
            "slot": {
                "type": "string",
                "title": "시간 슬롯",
                "description": "확인할 시간 슬롯(선택, 없으면 전체).",
            },
        },
        "required": ["member_id", "date"],
    },
}
