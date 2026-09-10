from datetime import date, datetime, time, timedelta, timezone

from app.core.datetime_utils import KST, kst_to_utc_naive, to_utc_naive, utc_now
from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import MemberWorkingTimeFacade, OperatingTimeFacade
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import AppScheduleChangeRequestResponse
from app.modules.counseling.facade import CounselingCaseFacade, CounselingSessionFacade
from app.modules.event import emit
from app.modules.family.facade import FamilyFacade
from app.modules.schedule.facade import ScheduleChangeRequestFacade, ScheduleFacade

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


async def request_app_schedule_change_handler(
    *,
    person_id: uuid_str,
    schedule_id: uuid_str,
    start_time: datetime,
    reason: str | None,
    event_group_id: uuid_str,
    uow: UnitOfWork,
) -> AppScheduleChangeRequestResponse:
    # access — 가족 활성 링크의 내담자가 참여한 상담 일정만
    family_id = await FamilyFacade(uow).find_family_id(person_id=person_id)
    if family_id is None:
        raise InvalidOperationException("연결된 센터가 없습니다")

    links = await CenterLinkFacade(uow).list_links_by_family(family_id=family_id, alive_only=True)
    family_clients = {
        (link.center_id, link.client_id) for link in links if link.status == "active"
    }
    if not family_clients:
        raise InvalidOperationException("연결된 센터가 없습니다")

    # case — 취소된 회기는 매핑에서 빠지고, 검사 일정은 None(앱 변경 미지원)
    case_facade = CounselingCaseFacade(uow)
    case = (await case_facade.aggregate_cases_by_schedule_ids([schedule_id])).get(schedule_id)
    if case is None:
        raise InvalidOperationException("이 일정은 앱에서 변경할 수 없어요")

    client_ids = (await case_facade.aggregate_active_client_ids_by_case_ids([case.id])).get(case.id, [])
    if not any((case.center_id, cid) in family_clients for cid in client_ids):
        raise InvalidOperationException("이 일정을 변경할 권한이 없어요")

    # session
    sessions = await CounselingSessionFacade(uow).get_sessions_by_case_ids([case.id])
    if not any(s.schedule_id == schedule_id for s in sessions):
        raise InvalidOperationException("이 일정은 앱에서 변경할 수 없어요")

    schedule = await ScheduleFacade(uow).get_schedule(schedule_id=schedule_id, center_id=case.center_id)

    # verify — 화면에 그려진 뒤 슬롯이 닫혔을 수 있으므로 제출 시점에 다시 본다
    requested_start = to_utc_naive(start_time)
    duration = schedule.end - schedule.start
    requested_end = requested_start + duration

    requested_kst = requested_start.replace(tzinfo=timezone.utc).astimezone(KST)
    slots = await _compute_slot_availability(
        uow=uow,
        center_id=case.center_id,
        member_id=schedule.member_id,
        target_date=requested_kst.date(),
        duration_minutes=int(duration.total_seconds() // 60),
        exclude_schedule_id=schedule_id,
    )
    requested_label = requested_kst.strftime("%H:%M")
    if not any(slot == requested_label and available for slot, available in slots):
        raise InvalidOperationException("선택한 시간은 예약할 수 없어요")

    # create
    atomic, request = await ScheduleChangeRequestFacade(uow).create_change_request(
        center_id=case.center_id,
        schedule_id=schedule_id,
        person_id=person_id,
        client_id=client_ids[0],
        current_start=schedule.start,
        current_end=schedule.end,
        requested_start=requested_start,
        requested_end=requested_end,
        reason=(reason or "").strip() or None,
    )
    await emit(
        uow,
        "schedule_change_requested",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=case.center_id,
    )

    # return
    return AppScheduleChangeRequestResponse(
        request_id=request.id,
        schedule_id=schedule_id,
        status=request.status,
        requested_start=requested_start,
        requested_end=requested_end,
    )
