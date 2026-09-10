from datetime import date, datetime, timedelta, time as dt_time

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.type import unset, uuid_str
from app.modules.event import emit
from app.core.datetime_utils import kst_to_utc_naive
from app.modules.counseling.facade import CounselingCaseFacade, CounselingSessionFacade
from app.modules.schedule.facade import ScheduleFacade
from app.application.schemas import BulkSessionUpdateRequest, BulkSessionUpdateResponse


def _parse_time(time_str: str) -> dt_time:
    h, m = time_str.split(":")
    return dt_time(int(h), int(m))


def _utc_to_kst_date(utc_naive: datetime) -> date:
    return (utc_naive + timedelta(hours=9)).date()


def _format_kst(utc_naive: datetime) -> str:
    kst = utc_naive + timedelta(hours=9)
    return kst.strftime("%Y-%m-%d %H:%M")


async def bulk_update_sessions_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    owner_scope: str | None,
    data: BulkSessionUpdateRequest,
    uow: UnitOfWork,
    actor_id: str | None = None,
) -> BulkSessionUpdateResponse:
    # day_offset/start/end 는 모두 KST 기준 입력 — DB는 UTC naive 저장이라 KST→UTC 변환 필요
    case_facade = CounselingCaseFacade(uow)
    session_facade = CounselingSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    # 권한 확인: 첫 세션의 케이스 소유자 검증
    first_session = await session_facade.get_session(data.session_ids[0], center_id)
    await case_facade.get_case_by_id(
        first_session.counseling_case_id, center_id, owner_scope
    )

    has_schedule_change = (
        data.day_offset or data.start or data.end or data.room_id is not None
    )
    warnings: list[str] = []
    schedule_updated_atomics = []
    participant_added_atomics = []
    participant_removed_atomics = []

    for session_id in data.session_ids:
        session = await session_facade.get_session(session_id, center_id)

        if has_schedule_change:
            schedule = await schedule_facade.get_schedule(
                session.schedule_id, center_id
            )

            kst_date = _utc_to_kst_date(schedule.start)
            if data.day_offset:
                kst_date = kst_date + timedelta(days=data.day_offset)

            new_start = None
            new_end = None

            if data.day_offset or data.start:
                kst_start_time = (
                    _parse_time(data.start)
                    if data.start
                    else (schedule.start + timedelta(hours=9)).time()
                )
                new_start = kst_to_utc_naive(kst_date, kst_start_time)

            if data.day_offset or data.end:
                kst_end_time = (
                    _parse_time(data.end)
                    if data.end
                    else (schedule.end + timedelta(hours=9)).time()
                )
                new_end = kst_to_utc_naive(kst_date, kst_end_time)

            sch_atomic, _ = await schedule_facade.update_schedule(
                center_id=center_id,
                schedule_id=session.schedule_id,
                start=new_start if new_start is not None else unset,
                end=new_end if new_end is not None else unset,
                room_id=data.room_id if data.room_id is not None else unset,
            )
            schedule_updated_atomics.append(sch_atomic)

            check_room = data.room_id if data.room_id is not None else schedule.room_id
            check_start = new_start if new_start else schedule.start
            check_end = new_end if new_end else schedule.end

            if check_room:
                conflicts = await schedule_facade.validate_schedule(
                    center_id=center_id,
                    room_id=check_room,
                    start=check_start,
                    end=check_end,
                    exclude_id=session.schedule_id,
                )
                if conflicts:
                    conflict_titles = [c.title or "일정" for c in conflicts]
                    warnings.append(
                        f"{_format_kst(check_start)} - "
                        f"동일 장소에 겹치는 일정: {', '.join(conflict_titles)}"
                    )

        if data.member_id:
            sch_atomic, _ = await schedule_facade.update_schedule(
                center_id=center_id,
                schedule_id=session.schedule_id,
                member_id=data.member_id,
            )
            schedule_updated_atomics.append(sch_atomic)

        if data.client_ids is not None:
            (
                removed_atomics,
                _,
            ) = await session_facade.delete_session_participants_by_type(
                session_id, "client"
            )
            participant_removed_atomics.extend(removed_atomics)
            if data.client_ids:
                sp_atomics, _ = await session_facade.add_session_participants(
                    session_id=session_id,
                    center_id=center_id,
                    counselor_id=None,
                    client_ids=data.client_ids,
                )
                participant_added_atomics.extend(sp_atomics)

        if data.counselor_ids is not None:
            (
                removed_atomics,
                _,
            ) = await session_facade.delete_session_participants_by_type(
                session_id, "counselor"
            )
            participant_removed_atomics.extend(removed_atomics)
            if data.counselor_ids:
                sp_atomics, _ = await session_facade.add_session_participants(
                    session_id=session_id,
                    center_id=center_id,
                    counselor_id=None,
                    counselor_ids=data.counselor_ids,
                )
                participant_added_atomics.extend(sp_atomics)

    await emit(
        uow,
        "counseling_sessions_updated",
        event_group_id=event_group_id,
        atomics=[
            *schedule_updated_atomics,
            *participant_added_atomics,
            *participant_removed_atomics,
        ],
        center_id=center_id,
        actor_id=actor_id,
    )

    # return
    return BulkSessionUpdateResponse(
        updated_count=len(data.session_ids),
        warnings=warnings,
    )


TOOL = {
    "name": "bulk_update_sessions_handler",
    "permission": "write:counseling",
    "purpose": "선택한 여러 상담 회기의 일정(날짜 이동·시간·장소·담당자·참여자)을 한 번에 일괄 변경한다.",
    "keywords": [
        "bulk update sessions",
        "회기 일괄 수정",
        "여러 회기 한번에",
        "날짜 밀기",
        "시간 변경",
        "장소 변경",
        "담당자 일괄 변경",
        "세션 일괄 편집",
        "스케줄 이동",
    ],
    "boundaries": "이미 존재하는 여러 회기를 골라 같은 변경을 한꺼번에 적용하는 도구다(예: 선택한 회기 전부 하루 뒤로). 실제로 반영하기 전 충돌만 미리 확인하려면 validate_bulk_update_sessions_handler를 쓴다. 케이스의 내담자/담당자/회기 날짜 전체를 diff로 통합 수정하려면 apply_case_edits_handler, 회기를 새로 추가하려면 add_sessions_to_case_handler를 쓴다. day_offset/start/end는 모두 KST 기준 입력이다.",
    "output": "일괄 회기 변경 결과 (BulkSessionUpdateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_ids": {
                "items": {"type": "string", "format": "uuid"},
                "maxItems": 50,
                "minItems": 1,
                "title": "대상 회기 목록",
                "type": "array",
                "description": "일괄 변경할 회기 UUID 목록(최대 50).",
            },
            "start": {
                "anyOf": [
                    {"pattern": "^\\d{2}:\\d{2}$", "type": "string"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "시작 시간 HH:MM(미지정 시 유지).",
                "title": "시작 시간",
            },
            "end": {
                "anyOf": [
                    {"pattern": "^\\d{2}:\\d{2}$", "type": "string"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "종료 시간 HH:MM(미지정 시 유지).",
                "title": "종료 시간",
            },
            "day_offset": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "default": None,
                "description": "날짜 이동(일 단위, +1=하루 뒤/-2=이틀 앞, 선택).",
                "title": "날짜 이동",
            },
            "room_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "상담실 UUID(미지정 시 유지).",
                "title": "상담실",
            },
            "member_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "담당자 member_id(미지정 시 유지).",
                "title": "담당자",
            },
            "client_ids": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "내담자 UUID 목록(전체 교체, 미지정 시 유지).",
                "title": "내담자 목록",
            },
            "counselor_ids": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "상담사 UUID 목록(전체 교체, 미지정 시 유지).",
                "title": "상담사 목록",
            },
        },
        "required": ["session_ids"],
    },
}
