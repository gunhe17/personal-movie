from datetime import timedelta, time as dt_time

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.type import uuid_str
from app.core.datetime_utils import to_utc_naive, kst_to_utc_naive
from app.modules.event import emit
from app.modules.counseling.facade import CounselingCaseFacade, CounselingSessionFacade
from app.modules.schedule.facade import ScheduleFacade
from app.modules.schedule.schedule.helpers import format_conflict_warning
from .schemas import CaseWithSessionsCreate, CaseWithSessionsResponse, SessionSummary


def _parse_time(time_str: str) -> dt_time:
    h, m = time_str.split(":")
    return dt_time(int(h), int(m))


async def intake_case_handler(
    event_group_id: uuid_str,
    center_id: str,
    member_id: str,
    data: CaseWithSessionsCreate,
    uow: UnitOfWork,
) -> CaseWithSessionsResponse:
    # 두 모드: dates=멀티 날짜 직접 선택 / recurrence=start + 반복 패턴. 중복 접수 시 ConflictException
    from app.modules.schedule.schedule.schemas import BatchScheduleValidation
    from app.core.exceptions import ConflictException, InvalidOperationException

    schedule_facade = ScheduleFacade(uow)

    duration_minutes = data.sessions.duration_minutes

    if data.sessions.dates:
        if not data.sessions.start_time or not data.sessions.end_time:
            raise InvalidOperationException(
                "직접 선택 모드에서는 start_time, end_time이 필수입니다"
            )

        start_t = _parse_time(data.sessions.start_time)
        end_t = _parse_time(data.sessions.end_time)

        duration_minutes = (end_t.hour * 60 + end_t.minute) - (
            start_t.hour * 60 + start_t.minute
        )
        if duration_minutes <= 0:
            duration_minutes = data.sessions.duration_minutes

        session_dates = [to_utc_naive(d) for d in data.sessions.dates]
        total_sessions_count = len(session_dates)

        # 프론트에서 감지된 반복 패턴을 session_rule로 저장(이후 회기 추가의 규칙 소스)
        session_rule = data.sessions.session_rule

    elif data.sessions.start:
        # recurrence 모드 (레거시) — UTC-naive 변환 후 KST 기준 date/time 추출
        start_utc = to_utc_naive(data.sessions.start)
        start_kst = start_utc + timedelta(hours=9)
        start_date = start_kst.date()
        start_time = start_kst.strftime("%H:%M")

        if data.sessions.recurrence:
            validation_result = await schedule_facade.validate_recurring_schedules(
                center_id=center_id,
                data=BatchScheduleValidation(
                    start_date=start_date,
                    start_time=start_time,
                    recurrence=data.sessions.recurrence,
                    room_id=data.sessions.room_id,
                    duration_minutes=duration_minutes,
                ),
            )
            session_dates = validation_result.schedule_dates
            total_sessions_count = len(session_dates)
        else:
            session_dates = [start_utc]
            total_sessions_count = 1

        session_rule = None
        if data.sessions.recurrence:
            session_rule = {
                "recurrence": data.sessions.recurrence.model_dump(),
                "duration_minutes": duration_minutes,
                "room_id": data.sessions.room_id,
                "start_time": start_time,
            }
    else:
        raise InvalidOperationException("dates 또는 start 중 하나를 지정해야 합니다")

    # 중복 체크: counseling 모듈이 program/counselor/participants 일치 후보를 찾고,
    # 일정(시작·장소) 최종 일치 판정은 여기서 ScheduleFacade로 수행한다.
    case_facade = CounselingCaseFacade(uow)

    candidate = await case_facade.find_duplicate_candidate(
        center_id=center_id,
        program_id=data.case.program_id,
        counselor_id=data.case.counselor_ids[0],
        client_ids=data.case.client_ids,
        minutes_threshold=5,
    )

    if candidate is not None:
        candidate_schedules = await schedule_facade.list_schedules_by_ids(
            [candidate.first_schedule_id]
        )
        if candidate_schedules:
            first_schedule = candidate_schedules[0]
            if (
                first_schedule.start == session_dates[0]
                and first_schedule.room_id == data.sessions.room_id
            ):
                raise ConflictException(
                    f"최근에 동일한 상담 접수가 생성되었습니다. (케이스 번호: {candidate.case_code})"
                )

    case_atomic, case = await case_facade.create_case(
        center_id=center_id,
        counselor_id=data.case.counselor_ids[0],
        program_id=data.case.program_id,
        chief_complaint=data.case.chief_complaint,
        memo=data.case.memo,
        total_sessions=total_sessions_count,
        session_rule=session_rule,
    )

    participant_added_atomics = []
    for client_id in data.case.client_ids:
        p_atomics, _ = await case_facade.add_participant(
            case_id=case.id,
            center_id=center_id,
            counselor_id=None,
            participant_id=client_id,
            participant_type="client",
        )
        participant_added_atomics.extend(p_atomics)

    for counselor_id in data.case.counselor_ids:
        p_atomics, _ = await case_facade.add_participant(
            case_id=case.id,
            center_id=center_id,
            counselor_id=None,
            participant_id=counselor_id,
            participant_type="counselor",
        )
        participant_added_atomics.extend(p_atomics)

    session_facade = CounselingSessionFacade(uow)

    sessions = []
    schedule_atomics = []
    created_session_atomics = []
    warnings = []
    for idx, session_start in enumerate(session_dates):
        session_number = idx + 1

        if data.sessions.dates:
            session_start_dt = kst_to_utc_naive(session_start.date(), start_t)
            session_end_dt = kst_to_utc_naive(session_start.date(), end_t)
        else:
            session_start_dt = session_start
            session_end_dt = session_start + timedelta(minutes=duration_minutes)

        # 충돌은 막지 않고 경고만 수집
        schedule_atomic, schedule = await schedule_facade.create_schedule(
            center_id=center_id,
            schedule_type="counseling",
            start=session_start_dt,
            end=session_end_dt,
            member_id=data.case.counselor_ids[0],
            room_id=data.sessions.room_id,
            title=f"{case.case_code} - {session_number}회기",
            memo=data.sessions.memo,
        )
        schedule_atomics.append(schedule_atomic)
        conflicts = await schedule_facade.list_conflicting_schedules(
            center_id=center_id,
            start=schedule.start,
            end=schedule.end,
            room_id=schedule.room_id,
            member_id=schedule.member_id,
            exclude_id=schedule.id,
        )

        warning_msg = format_conflict_warning(
            conflicts=conflicts,
            check_room_id=data.sessions.room_id,
            check_member_id=data.case.counselor_ids[0],
            session_number=session_number,
            session_start=session_start_dt,
        )
        if warning_msg:
            warnings.append(warning_msg)

        session_atomics, session = await session_facade.create_session(
            center_id=center_id,
            counselor_id=None,
            counseling_case_id=case.id,
            schedule_id=schedule.id,
            session_number=session_number,
        )

        sessions.append(session)
        created_session_atomics.extend(session_atomics)

    # 접수 알림·접수 SMS·리마인드 SMS는 반응(notify_counseling_case_created /
    # sms_counseling_case_created / sms_counseling_session_reminder)이 워커에서 처리

    await emit(
        uow,
        "counseling_case_intaken",
        event_group_id=event_group_id,
        atomics=[
            case_atomic,
            *participant_added_atomics,
            *schedule_atomics,
            *created_session_atomics,
        ],
        center_id=center_id,
        actor_id=member_id,
    )

    return CaseWithSessionsResponse(
        case_id=case.id,
        case_code=case.case_code,
        total_sessions=len(sessions),
        sessions=[
            SessionSummary(
                id=s.id,
                session_number=idx + 1,
                schedule_id=s.schedule_id,
                start=session_dates[idx],
                end=session_dates[idx] + timedelta(minutes=duration_minutes),
                room_id=data.sessions.room_id,
            )
            for idx, s in enumerate(sessions)
        ],
        created_at=case.created_at,
        warnings=warnings,
    )


TOOL = {
    "name": "intake_case_handler",
    "permission": "write:counseling",
    "purpose": "새 상담 케이스를 접수하고 그에 딸린 회기 일정 전체를 한 트랜잭션으로 생성한다.",
    "keywords": [
        "create case with sessions",
        "상담 접수",
        "케이스 생성",
        "신규 상담 등록",
        "회기 일괄 예약",
        "상담 시작",
        "내담자 접수",
        "예약 잡기",
        "상담 등록",
    ],
    "boundaries": "상담을 '처음 접수'하며 케이스와 회기 일정을 동시에 만드는 진입 도구다. 이미 있는 케이스에 회기만 더 붙이려면 add_sessions_to_case_handler, 케이스 정보만 고치려면 update_case_handler를 쓴다. 최근 동일 프로그램·상담사·내담자·일정의 중복 접수가 감지되면 ConflictException으로 막는다. 회기 날짜는 dates(직접 선택한 멀티 날짜) 또는 recurrence(시작일 + 반복 패턴) 중 하나로 지정한다.",
    "output": "생성된 케이스와 회기 일정 (CaseWithSessionsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case": {"$ref": "#/$defs/CounselingCaseInput"},
            "sessions": {"$ref": "#/$defs/SessionScheduleInput"},
        },
        "$defs": {
            "CounselingCaseInput": {
                "example": {
                    "chief_complaint": "발음 문제",
                    "client_ids": ["client-uuid-1"],
                    "counselor_ids": ["counselor-uuid-1"],
                    "memo": "부모 상담 필요",
                    "program_id": "program-uuid",
                },
                "properties": {
                    "program_id": {
                        "description": "프로그램 ID",
                        "title": "Program Id",
                        "type": "string",
                    },
                    "client_ids": {
                        "description": "내담자 ID 목록",
                        "items": {"type": "string"},
                        "minItems": 1,
                        "title": "Client Ids",
                        "type": "array",
                    },
                    "counselor_ids": {
                        "description": "상담사 ID 목록 (첫번째가 주담당)",
                        "items": {"type": "string"},
                        "minItems": 1,
                        "title": "Counselor Ids",
                        "type": "array",
                    },
                    "chief_complaint": {
                        "anyOf": [
                            {"maxLength": 1000, "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "주호소",
                        "title": "Chief Complaint",
                    },
                    "memo": {
                        "anyOf": [
                            {"maxLength": 2000, "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "메모",
                        "title": "Memo",
                    },
                },
                "required": ["program_id", "client_ids", "counselor_ids"],
                "title": "CounselingCaseInput",
                "type": "object",
            },
            "RecurrencePattern": {
                "examples": [
                    {"count": 3, "interval": 1, "pattern": "daily"},
                    {
                        "count": 6,
                        "days_of_week": ["monday", "wednesday", "friday"],
                        "interval": 1,
                        "pattern": "weekly",
                    },
                    {
                        "count": 3,
                        "interval": 1,
                        "monthly_repeat_types": ["day", "weekday"],
                        "pattern": "monthly",
                    },
                ],
                "properties": {
                    "pattern": {
                        "description": "반복 유형",
                        "enum": ["daily", "weekly", "monthly"],
                        "title": "Pattern",
                        "type": "string",
                    },
                    "interval": {
                        "default": 1,
                        "description": "반복 간격 (N일/N주/N개월마다)",
                        "maximum": 100,
                        "minimum": 1,
                        "title": "Interval",
                        "type": "integer",
                    },
                    "count": {
                        "anyOf": [
                            {"maximum": 100, "minimum": 1, "type": "integer"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "총 반복 횟수",
                        "title": "Count",
                    },
                    "until": {
                        "anyOf": [
                            {"format": "date", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "반복 종료일 (YYYY-MM-DD)",
                        "title": "Until",
                    },
                    "days_of_week": {
                        "anyOf": [
                            {
                                "items": {
                                    "enum": [
                                        "monday",
                                        "tuesday",
                                        "wednesday",
                                        "thursday",
                                        "friday",
                                        "saturday",
                                        "sunday",
                                    ],
                                    "type": "string",
                                },
                                "type": "array",
                            },
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "요일 목록 (weekly 시)",
                        "title": "Days Of Week",
                    },
                    "monthly_repeat_types": {
                        "anyOf": [
                            {
                                "items": {
                                    "enum": [
                                        "day",
                                        "weekday",
                                        "last_weekday",
                                        "last_day",
                                    ],
                                    "type": "string",
                                },
                                "type": "array",
                            },
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "월간 반복 타입 (monthly 시)",
                        "title": "Monthly Repeat Types",
                    },
                },
                "required": ["pattern"],
                "title": "RecurrencePattern",
                "type": "object",
            },
            "SessionScheduleInput": {
                "example": {
                    "dates": ["2026-01-06T05:00:00Z", "2026-01-13T05:00:00Z"],
                    "duration_minutes": 60,
                    "end_time": "15:00",
                    "room_id": "room-uuid",
                    "start_time": "14:00",
                },
                "properties": {
                    "dates": {
                        "anyOf": [
                            {
                                "items": {"format": "date-time", "type": "string"},
                                "type": "array",
                            },
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "직접 선택한 날짜+시간 배열 (ISO 8601 UTC)",
                        "title": "Dates",
                    },
                    "start_time": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "시작 시간 (HH:MM, dates 모드에서 사용)",
                        "title": "Start Time",
                    },
                    "end_time": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "종료 시간 (HH:MM, dates 모드에서 사용)",
                        "title": "End Time",
                    },
                    "start": {
                        "anyOf": [
                            {"format": "date-time", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "시작 일시 (ISO 8601 UTC, recurrence 모드)",
                        "title": "Start",
                    },
                    "recurrence": {
                        "anyOf": [
                            {"$ref": "#/$defs/RecurrencePattern"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "반복 패턴 (선택적). 없으면 단일 회기만 생성",
                    },
                    "session_rule": {
                        "anyOf": [
                            {"additionalProperties": True, "type": "object"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "감지된 반복 패턴 (프론트에서 전달, case.session_rule에 저장)",
                        "title": "Session Rule",
                    },
                    "room_id": {
                        "description": "장소 ID",
                        "title": "Room Id",
                        "type": "string",
                    },
                    "duration_minutes": {
                        "default": 50,
                        "description": "소요 시간 (분)",
                        "maximum": 480,
                        "minimum": 10,
                        "title": "Duration Minutes",
                        "type": "integer",
                    },
                    "memo": {
                        "anyOf": [
                            {"maxLength": 2000, "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "일정에 표시될 메모",
                        "title": "Memo",
                    },
                },
                "required": ["room_id"],
                "title": "SessionScheduleInput",
                "type": "object",
            },
        },
        "required": ["case", "sessions"],
    },
}
