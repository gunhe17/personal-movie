from datetime import date
from app.core.datetime_utils import parse_date

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade.center_agent_facade import CenterAgentFacade



async def get_availability_handler(
    center_id: str,
    owner_scope: str | None,
    subject: str,
    view: str,
    member_id: str | None,
    room_id: str | None,
    weekday: str | None,
    target_date: str | None,
    slot: str | None,
    date_from: str | None,
    date_to: str | None,
    uow: UnitOfWork,
) -> list[dict]:
    facade = CenterAgentFacade(uow)
    td = parse_date(target_date, "target_date")

    if subject == "member":
        # 주어 생략("나 내일 빈 시간") = 본인
        if member_id is None and owner_scope is not None:
            member_id = owner_scope
        if member_id is None:
            return []  # member_id 필요 — query_member_handler로 확인 후 재호출
        if view == "hours":
            return await facade.query_working_time(
                center_id,
                member_id=member_id,
                weekday=weekday,
                fields=None,
            )
        if view == "holidays":
            return await facade.query_non_working_time(
                center_id,
                member_id=member_id,
                date_from=parse_date(date_from, "date_from"),
                date_to=parse_date(date_to, "date_to"),
                fields=None,
            )
        if view == "free_slots":
            result = await facade.query_working_time_slots(
                center_id,
                member_id=member_id,
                target_date=td,
            )
            return result if isinstance(result, list) else [result]
        result = await facade.query_working_time_check(
            center_id,
            member_id=member_id,
            target_date=td,
            slot=slot,
        )
        return result if isinstance(result, list) else [result]

    if view == "hours":
        return await facade.query_operating_time(
            center_id,
            day_of_week=weekday,
            fields=None,
        )
    if view == "holidays":
        return await facade.query_non_operating_time(
            center_id,
            date_from=parse_date(date_from, "date_from"),
            date_to=parse_date(date_to, "date_to"),
            reason=None,
            fields=None,
        )
    if view == "free_slots":
        result = await facade.query_operating_time_slots(center_id, target_date=td)
        return result if isinstance(result, list) else [result]
    if room_id:
        from app.application.handlers.center.get_room_slot_status import (
            get_room_slot_status_handler,
        )
        from app.modules.center.facade import RoomFacade

        room = (await RoomFacade(uow).get_rooms_by_ids([room_id])).get(room_id)
        if not room:
            return []
        resp = await get_room_slot_status_handler(center_id, room_id, td, slot, uow)
        return [
            {
                "applied_room_check_slot.date": resp.date,
                "applied_room_check_slot.slot": resp.slot,
                "applied_room_check_slot.room_name": room.name,
                "applied_room_check_slot.is_available": resp.is_available,
                "applied_room_check_slot.reason": resp.reason,
            }
        ]
    result = await facade.query_operating_time_check(
        center_id,
        target_date=td,
        slot=slot,
    )
    return result if isinstance(result, list) else [result]


TOOL = {
    "name": "get_availability_handler",
    "permission": None,
    "purpose": "센터/직원의 운영·근무시간, 휴무, 빈 시간대, 특정 시각 가능 여부를 조회한다.",
    "keywords": [
        "get availability",
        "운영시간",
        "근무시간",
        "휴무",
        "빈 시간",
        "예약 가능",
        "영업시간",
        "가능해?",
        "문 열어",
    ],
    "boundaries": "계산 조회 — subject=center(센터)|member(직원). "
    "member는 member_id 필요(이름은 query_member_handler로 id 확인, 주어 생략은 본인). "
    "일정 자체는 query_schedule_handler.",
    "output": "view별 행 배열 — hours: 요일별 시간, holidays: 휴무 목록, "
    "free_slots: 가능 시간대, check_slot: 가능 여부 판정.",
    "input_schema": {
        "type": "object",
        "properties": {
            "subject": {
                "type": "string",
                "enum": ["center", "member"],
                "description": "대상. 사람(선생님/직원/나)이 언급되면 member",
            },
            "view": {
                "type": "string",
                "enum": ["hours", "holidays", "free_slots", "check_slot"],
                "description": "'운영/근무시간'→hours, '휴무/쉬는 날'→holidays, "
                "'빈 시간/가능한 시간대'→free_slots, "
                "'되나요?/가능해?/열어?'(특정 시각)→check_slot",
            },
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "직원 UUID",
                "description": "subject=member일 때. 생략 시 본인",
            },
            "room_id": {
                "type": "string",
                "format": "uuid",
                "title": "상담실 UUID",
                "description": "특정 상담실 check_slot일 때",
            },
            "weekday": {
                "type": "string",
                "title": "요일",
                "enum": [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                ],
                "description": "'토요일 운영해?'→Saturday (hours 전용)",
            },
            "target_date": {
                "type": "string",
                "format": "date",
                "description": "free_slots/check_slot 대상 날짜. '내일'→오늘+1",
            },
            "slot": {
                "type": "string",
                "title": "시각 HH:MM",
                "description": "check_slot 필수. '오후 2시'→14:00",
            },
            "date_from": {
                "type": "string",
                "format": "date",
                "title": "휴무 기간 시작",
            },
            "date_to": {"type": "string", "format": "date", "title": "휴무 기간 종료"},
        },
        "required": ["subject", "view"],
    },
}
