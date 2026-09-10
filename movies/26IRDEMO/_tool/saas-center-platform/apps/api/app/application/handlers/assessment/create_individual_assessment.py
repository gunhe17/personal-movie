from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import InvalidOperationException
from app.core.datetime_utils import to_utc_naive
from app.core.type import uuid_str
from app.modules.event import emit

from app.application.schemas import (
    IndividualAssessmentCreate,
    IndividualAssessmentResponse,
)

from app.modules.assessment.facade import (
    AssessmentCaseFacade,
)
from app.modules.schedule.facade import ScheduleFacade
from app.modules.schedule.schedule.helpers import format_conflict_warning


async def create_individual_assessment_handler(
    center_id: str,
    data: IndividualAssessmentCreate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
) -> IndividualAssessmentResponse:
    if data.has_schedule:
        if not data.scheduled_start or not data.scheduled_end:
            raise InvalidOperationException(
                "일정을 생성하려면 scheduled_start와 scheduled_end가 필요합니다"
            )
        if data.scheduled_start >= data.scheduled_end:
            raise InvalidOperationException(
                "일정 종료 시간은 시작 시간보다 이후여야 합니다"
            )

    assessment_facade = AssessmentCaseFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    await assessment_facade.validate_assessments(center_id, data.assessment_ids)

    assessment_summary = await assessment_facade.get_assessment_summaries(
        data.assessment_ids
    )

    set_summary = None
    if data.set_id:
        set_summary = await assessment_facade.get_set_summary(center_id, data.set_id)

    # execution_method는 Assessment의 supports_online 필드로 자동 결정
    (
        case_atomics,
        case_result,
    ) = await assessment_facade.create_case_with_participants_and_tasks(
        center_id=center_id,
        counselor_id=data.counselor_id,
        client_ids=[data.client_id],
        assessment_ids=data.assessment_ids,
        assessment_summary=[s.model_dump(mode="json") for s in assessment_summary],
        set_summary=set_summary.model_dump(mode="json") if set_summary else None,
        tags=data.tags,
        is_final_report_required=data.is_final_report_required,
    )

    # 대면 검사: Schedule + Session 생성
    session_id = None
    schedule_id = None
    schedule_atomic = None
    session_atomics = []
    warnings: list[str] = []
    if data.has_schedule:
        # 일정 충돌은 차단하지 않고 경고로 수집해 응답에 싣는다
        schedule_atomic, schedule = await schedule_facade.create_schedule(
            center_id=center_id,
            schedule_type="assessment",
            start=to_utc_naive(data.scheduled_start),
            end=to_utc_naive(data.scheduled_end),
            member_id=data.counselor_id,
            room_id=data.room_id,
            memo=data.memo,
        )
        schedule_id = schedule.id
        conflicts = await schedule_facade.list_conflicting_schedules(
            center_id=center_id,
            start=schedule.start,
            end=schedule.end,
            room_id=schedule.room_id,
            member_id=schedule.member_id,
            exclude_id=schedule.id,
        )

        warning = format_conflict_warning(
            conflicts=conflicts,
            check_room_id=data.room_id,
            check_member_id=data.counselor_id,
            session_start=schedule.start,
        )
        if warning:
            warnings.append(warning)

        (
            session_atomics,
            session_result,
        ) = await assessment_facade.create_session_with_participants(
            center_id=center_id,
            case_id=case_result.case_id,
            schedule_id=schedule.id,
        )
        session_id = session_result.session_id

    # 접수 안내·리마인드 SMS는 반응(sms_assessment_case_created / sms_assessment_session_reminder)이 워커에서 처리

    emit_atomics = [*case_atomics]
    if schedule_atomic is not None:
        emit_atomics.append(schedule_atomic)
    emit_atomics.extend(session_atomics)

    await emit(
        uow,
        "assessment_case_created",
        event_group_id=event_group_id,
        atomics=emit_atomics,
        center_id=center_id,
        actor_id=data.counselor_id,
    )

    return IndividualAssessmentResponse(
        case_id=case_result.case_id,
        case_code=case_result.case_code,
        session_id=session_id,
        schedule_id=schedule_id,
        created_at=case_result.created_at,
        warnings=warnings if data.has_schedule else [],
    )


TOOL = {
    "name": "create_individual_assessment_handler",
    "permission": "write:assessment_case",
    "purpose": "내담자 한 명에게 검사 케이스를 생성한다.",
    "keywords": [
        "create individual assessment",
        "개별 검사 생성",
        "검사 배정",
        "내담자 검사 만들기",
        "단건 검사 케이스",
        "검사 시작",
        "검사 등록",
    ],
    "boundaries": "내담자 1명 단건 생성. 여러 명 일괄은 create_batch_assessment_handler. 검사 정의 생성(create_admin_assessment)과 다르다.",
    "output": "생성된 개인 검사 케이스 (IndividualAssessmentResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "description": "검사 대상 내담자의 UUID.",
                "title": "대상 내담자",
                "type": "string",
            },
            "assessment_ids": {
                "description": "실시할 검사 UUID 목록(최소 1개).",
                "items": {"type": "string"},
                "minItems": 1,
                "title": "검사 목록",
                "type": "array",
            },
            "is_final_report_required": {
                "default": False,
                "description": "종합보고서 필요 여부(기본 False).",
                "title": "종합보고서 필요",
                "type": "boolean",
            },
            "has_schedule": {
                "default": False,
                "description": "일정 동시 생성 여부(기본 False).",
                "title": "일정 생성",
                "type": "boolean",
            },
            "scheduled_start": {
                "anyOf": [{"format": "date-time", "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "일정 시작 시각(has_schedule 시).",
                "title": "일정 시작",
            },
            "scheduled_end": {
                "anyOf": [{"format": "date-time", "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "일정 종료 시각(has_schedule 시).",
                "title": "일정 종료",
            },
            "counselor_id": {
                "description": "담당 검사자(Member)의 UUID.",
                "title": "담당 검사자",
                "type": "string",
            },
            "room_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "장소(상담실) UUID(선택).",
                "title": "장소",
            },
            "memo": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "메모(선택).",
                "title": "메모",
            },
            "institution_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "연계 기관 UUID(선택).",
                "title": "기관",
            },
            "set_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "검사 세트 UUID(선택).",
                "title": "검사 세트",
            },
            "tags": {
                "description": "케이스 태그 목록.",
                "items": {"type": "string"},
                "title": "태그",
                "type": "array",
            },
        },
        "required": ["client_id", "assessment_ids", "counselor_id"],
    },
}
