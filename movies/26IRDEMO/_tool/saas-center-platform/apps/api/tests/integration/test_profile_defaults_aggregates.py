from datetime import datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.counseling.counseling_case.models import CounselingCase
from app.modules.counseling.facade import CounselingCaseFacade
from app.modules.schedule.facade import ScheduleFacade
from app.modules.schedule.schedule.models import Schedule

CENTER = "center-1"
MEMBER = "member-1"
SINCE = datetime(2026, 1, 1)


def _schedule(
    *,
    room_id,
    start,
    end,
    member_id=MEMBER,
    center_id=CENTER,
    schedule_type="counseling",
    deleted_at=None,
):
    return Schedule(
        center_id=center_id,
        member_id=member_id,
        schedule_type=schedule_type,
        room_id=room_id,
        start=start,
        end=end,
        deleted_at=deleted_at,
    )


async def test_usual_schedule_mode(test_session):
    d = datetime(2026, 3, 2, 10, 0)
    test_session.add_all([
        # room-a 50분 x2, room-b 60분 x1 → 최빈 (room-a, 50)
        _schedule(room_id="room-a", start=d, end=d.replace(minute=50)),
        _schedule(room_id="room-a", start=d.replace(hour=11), end=d.replace(hour=11, minute=50)),
        _schedule(room_id="room-b", start=d.replace(hour=13), end=d.replace(hour=14)),
        # 집계 제외 대상들
        _schedule(room_id="room-b", start=d, end=d.replace(hour=11), member_id="member-2"),
        _schedule(room_id="room-b", start=d, end=d.replace(hour=11), center_id="center-2"),
        _schedule(room_id="room-b", start=d, end=d.replace(hour=11), deleted_at=d),
        _schedule(room_id="room-b", start=d, end=d.replace(hour=11), schedule_type="meeting"),
        _schedule(room_id="room-b", start=datetime(2025, 12, 1), end=datetime(2025, 12, 1, 1)),
    ])
    await test_session.commit()

    room_id, duration = await ScheduleFacade(UnitOfWork(test_session)).aggregate_usual_schedule(
        center_id=CENTER, member_id=MEMBER, since=SINCE
    )
    assert (room_id, duration) == ("room-a", 50)


async def test_usual_schedule_tie_breaks_deterministically(test_session):
    d = datetime(2026, 3, 2, 10, 0)
    test_session.add_all([
        # room-a 1건 vs room-b 1건 · 50분 1건 vs 60분 1건 → id/분 오름차순 승자
        _schedule(room_id="room-b", start=d, end=d.replace(hour=11)),
        _schedule(room_id="room-a", start=d.replace(hour=13), end=d.replace(hour=13, minute=50)),
    ])
    await test_session.commit()

    room_id, duration = await ScheduleFacade(UnitOfWork(test_session)).aggregate_usual_schedule(
        center_id=CENTER, member_id=MEMBER, since=SINCE
    )
    assert (room_id, duration) == ("room-a", 50)


async def test_usual_schedule_empty(test_session):
    room_id, duration = await ScheduleFacade(UnitOfWork(test_session)).aggregate_usual_schedule(
        center_id=CENTER, member_id=MEMBER, since=SINCE
    )
    assert (room_id, duration) == (None, None)


def _case(
    *,
    program_id,
    case_code,
    counselor_id=MEMBER,
    center_id=CENTER,
    created_at=None,
    deleted_at=None,
):
    case = CounselingCase(
        center_id=center_id,
        program_id=program_id,
        counselor_id=counselor_id,
        case_code=case_code,
        deleted_at=deleted_at,
    )
    if created_at is not None:
        case.created_at = created_at
    return case


async def test_top_program_mode(test_session):
    test_session.add_all([
        # prog-a x2, prog-b x1 → 최빈 prog-a
        _case(program_id="prog-a", case_code="C00001"),
        _case(program_id="prog-a", case_code="C00002"),
        _case(program_id="prog-b", case_code="C00003"),
        # 집계 제외 대상들
        _case(program_id="prog-b", case_code="C00004", counselor_id="member-2"),
        _case(program_id="prog-b", case_code="C00005", center_id="center-2"),
        _case(program_id="prog-b", case_code="C00006", deleted_at=datetime(2026, 3, 1)),
        _case(program_id="prog-b", case_code="C00007", created_at=datetime(2025, 12, 1)),
    ])
    await test_session.commit()

    program_id = await CounselingCaseFacade(UnitOfWork(test_session)).aggregate_top_program(
        center_id=CENTER, counselor_id=MEMBER, since=SINCE
    )
    assert program_id == "prog-a"


async def test_top_program_tie_breaks_deterministically(test_session):
    test_session.add_all([
        _case(program_id="prog-b", case_code="C00001"),
        _case(program_id="prog-a", case_code="C00002"),
    ])
    await test_session.commit()

    program_id = await CounselingCaseFacade(UnitOfWork(test_session)).aggregate_top_program(
        center_id=CENTER, counselor_id=MEMBER, since=SINCE
    )
    assert program_id == "prog-a"


async def test_top_program_empty(test_session):
    program_id = await CounselingCaseFacade(UnitOfWork(test_session)).aggregate_top_program(
        center_id=CENTER, counselor_id=MEMBER, since=SINCE
    )
    assert program_id is None
