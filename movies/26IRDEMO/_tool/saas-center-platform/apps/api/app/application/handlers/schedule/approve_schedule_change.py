from datetime import date, datetime, time, timedelta, timezone

from app.core.datetime_utils import KST, kst_to_utc_naive, utc_now
from app.core.exceptions import ConflictException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import MemberWorkingTimeFacade, OperatingTimeFacade
from app.modules.event import emit
from app.modules.schedule.facade import ScheduleChangeRequestFacade, ScheduleFacade
from app.modules.schedule.schedule_change_request.schemas import ScheduleChangeRequestResponse

_TAKEN_MESSAGE = "요청하신 시간이 이미 예약됐어요. 다른 시간을 다시 선택해 주세요."

SLOT_MINUTES = 30


def _parse_slot(slot: str) -> time:
    hour, minute = slot.split(":")
    return time(int(hour), int(minute))


def _covering_slots(
    slot: str,
    duration_minutes: int,
) -> list[str]:
    base = _parse_slot(slot)
    anchor = datetime.combine(date(2000, 1, 1), base)
    steps = max(1, -(-duration_minutes // SLOT_MINUTES))
    return [(anchor + timedelta(minutes=SLOT_MINUTES * i)).strftime("%H:%M") for i in range(steps)]


async def _compute_slot_availability(
    *,
    uow: UnitOfWork,
    center_id: str,
    member_id: str | None,
    target_date: date,
    duration_minutes: int,
    exclude_schedule_id: str | None = None,
) -> list[tuple[str, bool]]:
    # grid — 센터 운영시간(휴무·휴게 제외)이 선택지의 바깥 테두리
    operating = await OperatingTimeFacade(uow).list_available_slots_with_response(
        center_id=center_id,
        target_date=target_date,
    )
    grid = operating.available_slots
    if not grid:
        return []

    # working — 담당 상담사 근무시간(연차·휴게 제외).
    # 근무시간을 한 번도 설정하지 않은 상담사(행 0개)는 센터 운영시간을 따른다 — 미설정을
    # "종일 비근무"로 읽으면 예약이 영원히 불가능해진다. 요일별 비근무는 행이 있으므로 존중된다.
    working: set[str] = set(grid)
    if member_id:
        working_facade = MemberWorkingTimeFacade(uow)
        configured = await working_facade.list_with_response(
            center_id=center_id,
            member_id=member_id,
        )
        if configured:
            member_slots = await working_facade.list_available_slots_with_response(
                center_id=center_id,
                member_id=member_id,
                target_date=target_date,
            )
            working = set(member_slots.available_slots)

    # busy — 같은 상담사의 그날 기존 일정
    day_start = kst_to_utc_naive(target_date, time(0, 0))
    day_end = day_start + timedelta(days=1)
    schedules = await ScheduleFacade(uow).list_schedules(
        center_id=center_id,
        start=day_start,
        end=day_end,
        member_ids=[member_id] if member_id else None,
    )
    busy = [
        (schedule.start, schedule.end)
        for schedule in schedules
        if schedule.id != exclude_schedule_id
    ]

    # compute
    now = utc_now().replace(tzinfo=None)
    result: list[tuple[str, bool]] = []
    for slot in grid:
        start = kst_to_utc_naive(target_date, _parse_slot(slot))
        end = start + timedelta(minutes=duration_minutes)
        covering = _covering_slots(slot, duration_minutes)
        available = (
            start > now
            and all(step in working for step in covering)
            and not any(busy_start < end and busy_end > start for busy_start, busy_end in busy)
        )
        result.append((slot, available))

    return result


async def approve_schedule_change_handler(
    *,
    center_id: str,
    request_id: str,
    actor_member_id: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> ScheduleChangeRequestResponse:
    request_facade = ScheduleChangeRequestFacade(uow)
    request = await request_facade.get_change_request(request_id=request_id, center_id=center_id)
    if request.status != "pending":
        raise ConflictException("이미 처리된 변경 요청이에요")

    schedule = await ScheduleFacade(uow).get_schedule(
        schedule_id=request.schedule_id,
        center_id=center_id,
    )

    # verify — 대기 중 다른 예약이 그 자리를 채웠을 수 있다
    requested_kst = request.requested_start.replace(tzinfo=timezone.utc).astimezone(KST)
    duration_minutes = int((request.requested_end - request.requested_start).total_seconds() // 60)
    slots = await _compute_slot_availability(
        uow=uow,
        center_id=center_id,
        member_id=schedule.member_id,
        target_date=requested_kst.date(),
        duration_minutes=duration_minutes,
        exclude_schedule_id=request.schedule_id,
    )
    if not any(slot == requested_kst.strftime("%H:%M") and ok for slot, ok in slots):
        atomic, _ = await request_facade.decide_change_request(
            request_id=request_id,
            center_id=center_id,
            status="rejected",
            decided_by_member_id=actor_member_id,
            decision_note=_TAKEN_MESSAGE,
        )
        await emit(
            uow,
            "schedule_change_request_rejected",
            event_group_id=event_group_id,
            atomics=[atomic],
            center_id=center_id,
        )
        raise ConflictException(_TAKEN_MESSAGE)

    # apply — 스태프 일정 변경과 같은 경로(보호자 schedule_changed 알림은 schedule.updated reaction이)
    schedule_atomic, _ = await ScheduleFacade(uow).update_schedule(
        center_id=center_id,
        schedule_id=request.schedule_id,
        start=request.requested_start,
        end=request.requested_end,
        changed={"start": request.requested_start.isoformat(), "end": request.requested_end.isoformat()},
    )
    request_atomic, approved = await request_facade.decide_change_request(
        request_id=request_id,
        center_id=center_id,
        status="approved",
        decided_by_member_id=actor_member_id,
    )
    # 그룹당 event 1개 + atomic N개 (eventing §4) — 일정 변경 사실은 atomic으로 동승
    await emit(
        uow,
        "schedule_change_request_approved",
        event_group_id=event_group_id,
        atomics=[schedule_atomic, request_atomic],
        center_id=center_id,
    )

    # return
    return ScheduleChangeRequestResponse.model_validate(approved)
