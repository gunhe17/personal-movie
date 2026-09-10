# 가용 = 센터 운영시간(center) AND 예약 충돌 없음(schedule) — 둘 다 만족해야 available
from datetime import date, datetime, time, timedelta

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.center_operating_time.schemas import RoomSlotStatusResponse
from app.modules.center.facade.operating_time_facade import SLOT_MINUTES
from app.modules.center.facade import OperatingTimeFacade
from app.modules.schedule.facade import ScheduleFacade


async def get_room_slot_status_handler(
    center_id: str,
    room_id: str,
    target_date: date,
    slot: str,
    uow: UnitOfWork,
) -> RoomSlotStatusResponse:
    operating_time_facade = OperatingTimeFacade(uow)
    center_check = await operating_time_facade.get_operating_status_with_response(
        center_id, target_date, slot
    )
    if not center_check.is_operating:
        return RoomSlotStatusResponse(
            date=center_check.date,
            slot=center_check.slot,
            is_available=False,
            reason=center_check.reason,
        )

    slot_start = datetime.combine(target_date, time(int(slot[:2]), int(slot[3:])))
    slot_end = slot_start + timedelta(minutes=SLOT_MINUTES)

    schedule_facade = ScheduleFacade(uow)
    conflicts = await schedule_facade.validate_schedule(
        center_id=center_id,
        room_id=room_id,
        start=slot_start,
        end=slot_end,
        exclude_id=None,
    )

    if conflicts:
        first = conflicts[0]
        title = first.title or "예약"
        time_range = f"{first.start.strftime('%H:%M')}~{first.end.strftime('%H:%M')}"
        return RoomSlotStatusResponse(
            date=target_date.isoformat(),
            slot=slot,
            is_available=False,
            reason=f"{title} ({time_range}) 예약 있음",
        )

    return RoomSlotStatusResponse(
        date=target_date.isoformat(),
        slot=slot,
        is_available=True,
        reason=None,
    )


TOOL = {
    "name": "get_room_slot_status_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "특정 상담실(룸)의 특정 날짜·시간 슬롯이 예약 가능한지 확인한다.",
    "keywords": [
        "check room slot",
        "룸 예약 가능",
        "방 비었나",
        "상담실 슬롯 확인",
        "예약 가능 시간",
        "룸 가용성",
        "slot 확인",
    ],
    "boundaries": "한 룸의 한 슬롯 가용성만 확인하는 읽기 도구다. 일정 생성은 schedule 쪽(create_schedule_handler)을 쓴다.",
    "output": "룸 슬롯 예약 가능 여부 (RoomSlotStatusResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "room_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 상담실",
                "description": "예약 가능 여부를 확인할 상담실(룸)의 UUID.",
            },
            "target_date": {
                "type": "string",
                "format": "date",
                "title": "확인 날짜",
                "description": "확인할 날짜.",
            },
            "slot": {
                "type": "string",
                "title": "시간 슬롯",
                "description": "확인할 시간 슬롯.",
            },
        },
        "required": ["room_id", "target_date", "slot"],
    },
}
