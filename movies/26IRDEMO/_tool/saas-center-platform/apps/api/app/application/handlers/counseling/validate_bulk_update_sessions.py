from datetime import date, datetime, timedelta, time as dt_time

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.datetime_utils import kst_to_utc_naive
from app.modules.counseling.facade import (
    CounselingCaseFacade,
    CounselingSessionFacade,
)
from app.modules.schedule.facade import ScheduleFacade
from app.application.schemas import (
    BulkSessionUpdateRequest,
    BulkSessionValidateResponse,
    BulkSessionConflict,
)


def _parse_time(time_str: str) -> dt_time:
    h, m = time_str.split(":")
    return dt_time(int(h), int(m))


def _utc_to_kst_date(utc_naive: datetime) -> date:
    return (utc_naive + timedelta(hours=9)).date()


def _format_kst(utc_naive: datetime) -> str:
    kst = utc_naive + timedelta(hours=9)
    return kst.strftime("%Y-%m-%d %H:%M")


async def validate_bulk_update_sessions_handler(
    center_id: str,
    data: BulkSessionUpdateRequest,
    uow: UnitOfWork,
    owner_scope: str | None = None,
) -> BulkSessionValidateResponse:
    # 읽기 전용 — 변경될 일정의 충돌을 미리 확인해 구조화된 conflicts로 반환(수정 없음)
    session_facade = CounselingSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)
    case_facade = CounselingCaseFacade(uow)
    conflicts: list[BulkSessionConflict] = []

    for session_id in data.session_ids:
        session = await session_facade.get_session(session_id, center_id)
        # 수정 전 검증이라 주담당 기준 — 공동 상담사는 열람만
        await case_facade.get_case_by_id(
            session.counseling_case_id, center_id, owner_scope
        )
        schedule = await schedule_facade.get_schedule(session.schedule_id, center_id)

        kst_date = _utc_to_kst_date(schedule.start)
        if data.day_offset:
            kst_date = kst_date + timedelta(days=data.day_offset)

        if data.day_offset or data.start:
            kst_start_time = (
                _parse_time(data.start)
                if data.start
                else (schedule.start + timedelta(hours=9)).time()
            )
            check_start = kst_to_utc_naive(kst_date, kst_start_time)
        else:
            check_start = schedule.start

        if data.day_offset or data.end:
            kst_end_time = (
                _parse_time(data.end)
                if data.end
                else (schedule.end + timedelta(hours=9)).time()
            )
            check_end = kst_to_utc_naive(kst_date, kst_end_time)
        else:
            check_end = schedule.end

        check_room = data.room_id if data.room_id is not None else schedule.room_id

        if check_room:
            conflicting = await schedule_facade.validate_schedule(
                center_id=center_id,
                room_id=check_room,
                start=check_start,
                end=check_end,
                exclude_id=session.schedule_id,
            )
            if conflicting:
                conflicts.append(
                    BulkSessionConflict(
                        date_kst=_format_kst(check_start),
                        session_id=session_id,
                        conflicting_titles=[c.title or "일정" for c in conflicting],
                    )
                )

    return BulkSessionValidateResponse(
        has_conflicts=len(conflicts) > 0,
        conflicts=conflicts,
    )


TOOL = {
    "name": "validate_bulk_update_sessions_handler",
    "permission": "read:counseling",
    "purpose": "여러 회기를 일괄 변경하기 전에 변경될 일정의 장소 충돌을 미리 점검해 구조화된 충돌 목록을 반환한다.",
    "keywords": [
        "validate bulk update sessions",
        "충돌 사전 확인",
        "일괄 수정 검증",
        "겹치는 일정 체크",
        "프리뷰",
        "변경 전 확인",
        "장소 충돌",
        "미리보기",
        "검증",
    ],
    "boundaries": "데이터를 바꾸지 않는 읽기 전용 사전 점검 도구다 — 일괄 변경을 적용했을 때 같은 상담실에 겹칠 일정만 미리 찾아 돌려준다. 실제로 변경을 반영하려면 bulk_update_sessions_handler를 쓴다(입력 형태는 동일). 케이스 메타 수정의 입력 검증은 validate_case_update_handler가 담당한다.",
    "output": "일괄 변경 전 장소 충돌 점검 결과 (BulkSessionValidateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_ids": {
                "items": {"type": "string", "format": "uuid"},
                "maxItems": 50,
                "minItems": 1,
                "title": "대상 회기 목록",
                "type": "array",
                "description": "충돌을 점검할 회기 UUID 목록(최대 50).",
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
