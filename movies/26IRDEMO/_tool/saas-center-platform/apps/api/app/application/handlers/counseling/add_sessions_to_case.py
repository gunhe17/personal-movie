from datetime import timedelta, time as dt_time

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.type import uuid_str
from app.core.exceptions import InvalidOperationException
from app.core.datetime_utils import kst_to_utc_naive
from app.modules.event import emit
from app.modules.counseling.counseling_case_participant.schemas import (
    CaseParticipantType,
)
from app.modules.counseling.facade import CounselingCaseFacade, CounselingSessionFacade
from app.modules.schedule.facade import ScheduleFacade
from app.modules.schedule.schedule.schemas import (
    BatchScheduleValidation,
    RecurrencePattern,
)
from app.application.schemas import AddSessionsRequest, AddSessionsResponse


def _parse_time(time_str: str) -> dt_time:
    h, m = time_str.split(":")
    return dt_time(int(h), int(m))


async def add_sessions_to_case_handler(
    event_group_id: uuid_str,
    center_id: str,
    member_id: str,
    case_id: str,
    data: AddSessionsRequest,
    uow: UnitOfWork,
    owner_scope: str | None = None,
) -> AddSessionsResponse:
    # 두 모드: count=session_rule 기반 날짜 자동 계산 / dates=전달받은 날짜+시간 직접 생성
    if not data.dates and not data.count:
        raise InvalidOperationException("count 또는 dates 중 하나를 지정해야 합니다")

    case_facade = CounselingCaseFacade(uow)
    # 회기 추가는 주담당 전용 — 공동 상담사는 열람만
    case = await case_facade.get_case_by_id(case_id, center_id, owner_scope)

    session_facade = CounselingSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    existing_sessions = await session_facade.list_sessions_with_response(
        case_id, center_id, None
    )
    existing_count = len(existing_sessions)

    # 회기 추가 시 지정된 담당자(주+보조) 중 케이스에 아직 없는 상담사를 케이스 참여자로 먼저 동기화.
    # 신규 세션 참여자는 case_participants 복사로 초기화되므로, 여기 없으면 보조가 유실된다
    # (apply_case_edits 와 동일 이유 — main S4 픽스 이식)
    participant_added_atomics = []
    if data.counselor_ids:
        participants_response = await case_facade.list_participants_with_response(
            case_id=case_id,
            center_id=center_id,
            counselor_id=None,
            active_only=True,
        )
        existing_counselor_ids = {
            p.participant_id
            for p in participants_response.items
            if p.participant_type.value == CaseParticipantType.COUNSELOR.value
        }
        for cid in data.counselor_ids:
            if cid not in existing_counselor_ids:
                p_atomics, _ = await case_facade.add_participant(
                    case_id=case_id,
                    center_id=center_id,
                    counselor_id=None,
                    participant_id=cid,
                    participant_type=CaseParticipantType.COUNSELOR,
                )
                participant_added_atomics.extend(p_atomics)

    created_sessions = []
    schedule_atomics = []
    created_session_atomics = []
    warnings = []

    if data.dates:
        if not data.start_time or not data.end_time:
            raise InvalidOperationException(
                "직접 선택 모드에서는 start_time, end_time이 필수입니다"
            )

        start_t = _parse_time(data.start_time)
        end_t = _parse_time(data.end_time)
        room_id = data.room_id
        counselor_id = (
            data.counselor_ids[0] if data.counselor_ids else case.counselor_id
        )

        for idx, date_val in enumerate(data.dates):
            session_number = existing_count + idx + 1
            session_start = kst_to_utc_naive(date_val.date(), start_t)
            session_end = kst_to_utc_naive(date_val.date(), end_t)

            schedule_atomic, schedule = await schedule_facade.create_schedule(
                center_id=center_id,
                schedule_type="counseling",
                start=session_start,
                end=session_end,
                member_id=counselor_id,
                room_id=room_id,
                title=f"{case.case_code} - {session_number}회기",
                memo=None,
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

            if conflicts:
                conflict_titles = [c.title or "일정" for c in conflicts]
                warnings.append(
                    f"{session_number}회기 ({session_start.strftime('%Y-%m-%d %H:%M')}) - "
                    f"동일 장소에 겹치는 일정이 있습니다: {', '.join(conflict_titles)}"
                )

            session_atomics, session = await session_facade.create_session(
                center_id=center_id,
                counselor_id=None,
                counseling_case_id=case_id,
                schedule_id=schedule.id,
                session_number=session_number,
            )
            created_sessions.append(session)
            created_session_atomics.extend(session_atomics)

    elif data.count:
        session_rule = case.session_rule
        if not session_rule:
            raise InvalidOperationException("반복 규칙이 없는 케이스입니다")

        schedule_ids = [s.schedule_id for s in existing_sessions]
        schedules = await schedule_facade.list_schedules_by_ids(schedule_ids)

        if not schedules:
            raise InvalidOperationException("기존 회기 일정이 없습니다")

        last_schedule_start = max(s.start for s in schedules)
        next_start_date = last_schedule_start.date() + timedelta(days=1)

        recurrence_data = session_rule["recurrence"].copy()
        recurrence_data = {k: v for k, v in recurrence_data.items() if v is not None}
        recurrence_data["count"] = data.count

        validation = await schedule_facade.validate_recurring_schedules(
            center_id=center_id,
            data=BatchScheduleValidation(
                start_date=next_start_date,
                start_time=session_rule["start_time"],
                recurrence=RecurrencePattern(**recurrence_data),
                room_id=session_rule["room_id"],
                duration_minutes=session_rule["duration_minutes"],
            ),
        )
        session_dates = validation.schedule_dates

        for idx, session_start in enumerate(session_dates):
            session_number = existing_count + idx + 1
            session_end = session_start + timedelta(
                minutes=session_rule["duration_minutes"]
            )

            schedule_atomic, schedule = await schedule_facade.create_schedule(
                center_id=center_id,
                schedule_type="counseling",
                start=session_start,
                end=session_end,
                member_id=case.counselor_id,
                room_id=session_rule["room_id"],
                title=f"{case.case_code} - {session_number}회기",
                memo=None,
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

            if conflicts:
                conflict_titles = [c.title or "일정" for c in conflicts]
                warnings.append(
                    f"{session_number}회기 ({session_start.strftime('%Y-%m-%d %H:%M')}) - "
                    f"동일 장소에 겹치는 일정이 있습니다: {', '.join(conflict_titles)}"
                )

            session_atomics, session = await session_facade.create_session(
                center_id=center_id,
                counselor_id=None,
                counseling_case_id=case_id,
                schedule_id=schedule.id,
                session_number=session_number,
            )
            created_sessions.append(session)
            created_session_atomics.extend(session_atomics)

    await emit(
        uow,
        "counseling_sessions_added",
        event_group_id=event_group_id,
        atomics=[*participant_added_atomics, *schedule_atomics, *created_session_atomics],
        center_id=center_id,
        actor_id=member_id,
    )

    return AddSessionsResponse(
        created_count=len(created_sessions),
        total_sessions=existing_count + len(created_sessions),
        warnings=warnings,
    )


TOOL = {
    "name": "add_sessions_to_case_handler",
    "permission": "write:counseling",
    "purpose": "기존 상담 케이스에 회기(세션)를 추가로 생성하고 각 회기의 일정을 잡는다.",
    "keywords": [
        "add sessions to case",
        "회기 추가",
        "세션 추가",
        "상담 회기 늘리기",
        "추가 예약",
        "일정 더 잡기",
        "연장",
        "회기 연장",
        "다음 회기",
    ],
    "boundaries": "이미 만들어진 케이스에 '뒤이어' 회기만 더 붙이는 도구다. 케이스 자체를 새로 만들려면 intake_case_handler를 쓴다. 기존 회기의 날짜·시간·담당자를 바꾸려면 bulk_update_sessions_handler나 apply_case_edits_handler를 쓴다. count(케이스에 저장된 반복 규칙대로 자동 계산) 또는 dates(직접 고른 날짜 배열) 중 하나는 반드시 지정해야 한다.",
    "output": "추가된 회기 결과 (AddSessionsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "회기를 덧붙일 상담 케이스의 UUID.",
            },
            "count": {
                "anyOf": [
                    {"maximum": 50, "minimum": 1, "type": "integer"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "추가할 회기 수(규칙대로 모드, dates 대신).",
                "title": "회기 수",
            },
            "dates": {
                "anyOf": [
                    {
                        "items": {"format": "date-time", "type": "string"},
                        "maxItems": 50,
                        "type": "array",
                    },
                    {"type": "null"},
                ],
                "default": None,
                "description": "직접 선택한 날짜 목록(count 대신).",
                "title": "날짜 목록",
            },
            "start_time": {
                "anyOf": [
                    {"pattern": "^\\d{2}:\\d{2}$", "type": "string"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "회기 시작 시간(HH:MM, 선택).",
                "title": "시작 시간",
            },
            "end_time": {
                "anyOf": [
                    {"pattern": "^\\d{2}:\\d{2}$", "type": "string"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "회기 종료 시간(HH:MM, 선택).",
                "title": "종료 시간",
            },
            "room_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "상담실 UUID(선택).",
                "title": "상담실",
            },
            "counselor_ids": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "담당 상담사 member_id 목록(선택).",
                "title": "담당 상담사",
            },
        },
        "required": ["case_id"],
    },
}
