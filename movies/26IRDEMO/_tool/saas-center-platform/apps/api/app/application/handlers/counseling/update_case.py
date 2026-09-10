from datetime import datetime, timedelta

from app.core.type import uuid_str
from app.modules.counseling.counseling_session.models import CounselingSessionStatus
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.counseling.counseling_case.schemas import (
    CounselingCaseUpdateWithReschedule,
    CounselingCaseResponse,
)
from app.modules.counseling.facade import CounselingCaseFacade, CounselingSessionFacade
from app.modules.schedule.facade import ScheduleFacade


async def update_case_handler(
    *,
    event_group_id: uuid_str,
    case_id: str,
    center_id: str,
    counselor_id: str | None,  # 권한 확인용
    data: CounselingCaseUpdateWithReschedule,
    uow: UnitOfWork,
    actor_id: str | None = None,
) -> CounselingCaseResponse:
    # 검증은 validate_case_update_handler 에서 완료 — 여기는 실행만.
    # 회기 재설정 시 기존 scheduled 세션 취소 후 새로 생성.
    case_facade = CounselingCaseFacade(uow)
    session_facade = CounselingSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    # unset 관통(D6) — omit/null 판정은 여기 한 곳. nullable 컬럼(chief_complaint·memo·total_sessions)은 null 관통
    case_fields = {
        k: getattr(data, k)
        for k in data.model_fields_set
        if k in ("counselor_id", "chief_complaint", "memo", "status", "total_sessions")
    }
    for non_nullable in ("counselor_id", "status"):
        if case_fields.get(non_nullable, "") is None:
            case_fields.pop(non_nullable)
    if "status" in case_fields:
        case_fields["status"] = case_fields["status"].value

    case_atomic, case_updated = await case_facade.update_case(
        case_id,
        center_id,
        counselor_id,
        changed=data.model_dump(mode="json", exclude_unset=True),
        **case_fields,
    )
    case_response = CounselingCaseResponse.model_validate(case_updated)

    schedule_updated_atomics = []
    schedule_deleted_atomics = []
    schedule_created_atomics = []
    session_cancelled_atomics = []
    session_created_atomics = []
    participant_added_atomics = []
    participant_removed_atomics = []

    # 담당자 변경 시 기존 scheduled 세션의 일정 담당자·참여자도 함께 변경
    if data.counselor_id:
        sessions = await session_facade.get_sessions_by_case_ids([case_id])
        scheduled_sessions = [
            s for s in sessions if s.status == CounselingSessionStatus.SCHEDULED
        ]

        for session in scheduled_sessions:
            sch_atomic, _ = await schedule_facade.update_schedule(
                center_id=center_id,
                schedule_id=session.schedule_id,
                member_id=data.counselor_id,
            )
            schedule_updated_atomics.append(sch_atomic)

            (
                removed_atomics,
                _,
            ) = await session_facade.delete_session_participants_by_type(
                session_id=session.id,
                participant_type="counselor",
            )
            participant_removed_atomics.extend(removed_atomics)

            sp_atomics, _ = await session_facade.add_session_participants(
                session_id=session.id,
                center_id=center_id,
                counselor_id=None,  # 권한 체크 생략
                client_ids=None,
                counselor_ids=[data.counselor_id],
            )
            participant_added_atomics.extend(sp_atomics)

        await uow.flush()

    if data.reschedule_settings:
        rs = data.reschedule_settings

        sessions = await session_facade.get_sessions_by_case_ids([case_id])
        scheduled_sessions = [
            s for s in sessions if s.status == CounselingSessionStatus.SCHEDULED
        ]

        schedule_ids_to_delete = [s.schedule_id for s in scheduled_sessions]

        for session in scheduled_sessions:
            c_atomic, _ = await session_facade.cancel_session_with_reason(
                session_id=session.id,
                center_id=center_id,
                counselor_id=None,
            )
            session_cancelled_atomics.append(c_atomic)

        if schedule_ids_to_delete:
            schedule_deleted_atomics, _ = await schedule_facade.delete_schedules(
                schedule_ids_to_delete
            )

        # rs.start_date/start_time 은 이미 UTC-naive
        start_datetime = datetime.combine(rs.start_date, rs.start_time)

        interval_days = 7 if rs.pattern == "weekly" else 14

        case = await case_facade.get_case_by_id(case_id, center_id)

        for i in range(rs.remaining_sessions_count):
            session_start = start_datetime + timedelta(days=interval_days * i)
            session_end = session_start + timedelta(minutes=rs.duration_minutes)

            sch_c_atomic, schedule = await schedule_facade.create_schedule(
                center_id=center_id,
                schedule_type="counseling",
                start=session_start,
                end=session_end,
                member_id=case.counselor_id,
                room_id=rs.room_id,
                title="상담 회기",
                memo=None,
            )

            schedule_created_atomics.append(sch_c_atomic)

            # 세션 생성 (create_session 내부에서 참여자 초기화도 수행)
            session_atomics, session = await session_facade.create_session(
                center_id=center_id,
                counselor_id=case.counselor_id,
                counseling_case_id=case_id,
                schedule_id=schedule.id,
            )
            session_created_atomics.extend(session_atomics)

    # emit — 수정 알림은 반응(notify_counseling_case_updated)이 워커에서 발송
    await emit(
        uow,
        "counseling_case_updated",
        event_group_id=event_group_id,
        atomics=[
            case_atomic,
            *schedule_updated_atomics,
            *schedule_deleted_atomics,
            *session_cancelled_atomics,
            *schedule_created_atomics,
            *session_created_atomics,
            *participant_added_atomics,
            *participant_removed_atomics,
        ],
        center_id=center_id,
        actor_id=actor_id,
    )

    return case_response


TOOL = {
    "name": "update_case_handler",
    "permission": "write:counseling",
    "purpose": "상담 케이스의 정보(담당자·주호소·메모·총 회기 수·상태)를 수정하고, 필요 시 남은 회기 일정을 새 패턴으로 재설정한다.",
    "keywords": [
        "update case",
        "케이스 수정",
        "상담 정보 변경",
        "담당자 변경",
        "상태 변경",
        "종결 처리",
        "회기 재설정",
        "리스케줄",
        "케이스 업데이트",
    ],
    "boundaries": "케이스 메타(담당자·주호소·메모·총 회기·상태)를 부분 수정하고, reschedule_settings를 주면 기존 예약 회기를 취소하고 새 반복 패턴으로 재생성하는 도구다. 여러 회기의 시간만 일괄 이동하려면 bulk_update_sessions_handler를, 내담자/담당자/회기 날짜 전체를 diff로 통합 반영하려면 apply_case_edits_handler를, 케이스 자체를 지우려면 delete_case_handler를 쓴다. 실제 수정 전 입력 검증만 하려면 validate_case_update_handler를 먼저 호출한다.",
    "output": "수정된 상담 케이스 (CounselingCaseResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "수정할 상담 케이스의 UUID.",
            },
            "counselor_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "담당 상담사 UUID(변경 시 예약 회기 담당자도 함께 변경, 미지정 시 유지).",
                "title": "담당 상담사",
            },
            "chief_complaint": {
                "anyOf": [{"maxLength": 1000, "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "주호소(미지정 시 유지).",
                "title": "주호소",
            },
            "memo": {
                "anyOf": [{"maxLength": 2000, "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "메모(미지정 시 유지).",
                "title": "메모",
            },
            "total_sessions": {
                "anyOf": [
                    {"maximum": 999, "minimum": 1, "type": "integer"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "총 회기 수(이미 소진한 회기 수 이상, 미지정 시 유지).",
                "title": "총 회기 수",
            },
            "status": {
                "anyOf": [{"$ref": "#/$defs/CaseStatus"}, {"type": "null"}],
                "default": None,
                "description": "상태 (active: 진행중, completed: 종결, cancelled: 취소). 종결/취소 시 예약된 회기가 있으면 오류 발생",
            },
            "reschedule_settings": {
                "anyOf": [{"$ref": "#/$defs/RescheduleSettings"}, {"type": "null"}],
                "default": None,
                "description": "회기 재설정 정보 (제공 시 기존 예약된 회기를 취소하고 새 패턴으로 재생성)",
            },
        },
        "$defs": {
            "CaseStatus": {
                "enum": ["active", "completed", "cancelled"],
                "title": "CaseStatus",
                "type": "string",
            },
            "RescheduleSettings": {
                "description": "남은 회기 재설정 정보\n\n기존 예약된 회기를 취소하고 새로운 패턴으로 회기를 재생성합니다.",
                "example": {
                    "day_of_week": "monday",
                    "duration_minutes": 60,
                    "pattern": "weekly",
                    "remaining_sessions_count": 5,
                    "room_id": "123e4567-e89b-12d3-a456-426614174000",
                    "start_date": "2026-03-01",
                    "start_time": "14:00:00",
                },
                "properties": {
                    "pattern": {
                        "description": "반복 패턴 (weekly: 매주, biweekly: 격주)",
                        "enum": ["weekly", "biweekly"],
                        "title": "Pattern",
                        "type": "string",
                    },
                    "day_of_week": {
                        "description": "요일 (monday, tuesday, wednesday, thursday, friday, saturday, sunday)",
                        "title": "Day Of Week",
                        "type": "string",
                    },
                    "start_time": {
                        "description": "회기 시작 시간 (HH:MM:SS 형식)",
                        "format": "time",
                        "title": "Start Time",
                        "type": "string",
                    },
                    "duration_minutes": {
                        "description": "회기 소요 시간 (분, 10~480분)",
                        "maximum": 480,
                        "minimum": 10,
                        "title": "Duration Minutes",
                        "type": "integer",
                    },
                    "room_id": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "상담실 ID (선택적, 없으면 미지정)",
                        "title": "Room Id",
                    },
                    "start_date": {
                        "description": "첫 회기 날짜 (YYYY-MM-DD 형식)",
                        "format": "date",
                        "title": "Start Date",
                        "type": "string",
                    },
                    "remaining_sessions_count": {
                        "description": "생성할 회기 개수 (기존 예약 회기 포함, 최소 1개)",
                        "minimum": 1,
                        "title": "Remaining Sessions Count",
                        "type": "integer",
                    },
                },
                "required": [
                    "pattern",
                    "day_of_week",
                    "start_time",
                    "duration_minutes",
                    "start_date",
                    "remaining_sessions_count",
                ],
                "title": "RescheduleSettings",
                "type": "object",
            },
        },
        "required": ["case_id"],
    },
}
