from app.core.datetime_utils import utc_now
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import InvalidOperationException
from app.core.datetime_utils import to_utc_naive
from app.modules.event import emit

from app.application.schemas import BatchAssessmentCreate, BatchAssessmentResponse

from app.modules.assessment.facade import (
    AssessmentCaseFacade,
    BulkCaseCreationRequest,
    BulkSessionCreationRequest,
)
from app.modules.institution.facade import InstitutionFacade
from app.modules.schedule.facade import ScheduleFacade


async def create_batch_assessment_handler(
    center_id: str,
    data: BatchAssessmentCreate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> BatchAssessmentResponse:
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
    institution_facade = InstitutionFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    await assessment_facade.validate_assessments(center_id, data.assessment_ids)

    assessment_summary = await assessment_facade.get_assessment_summaries(
        data.assessment_ids
    )

    institution_summary = (
        await institution_facade.get_summary(data.institution_id)
        if data.institution_id
        else None
    )

    set_summary = None
    if data.set_id:
        set_summary = await assessment_facade.get_set_summary(center_id, data.set_id)

    # execution_method는 Assessment의 supports_online 필드로 자동 결정
    case_atomics, bulk_case_result = await assessment_facade.create_cases_bulk(
        BulkCaseCreationRequest(
            center_id=center_id,
            counselor_id=data.counselor_id,
            client_ids=data.client_ids,
            assistant_ids=data.assistant_ids,
            assessment_ids=data.assessment_ids,
            assessment_summary=assessment_summary,
            institution_summary=(
                institution_summary.model_dump() if institution_summary else None
            ),
            set_summary=set_summary,
            tags=data.tags,
            is_final_report_required=data.is_final_report_required,
        )
    )

    case_ids = [case.case_id for case in bulk_case_result.cases]

    schedule_id = None
    schedule_atomics = []
    session_atomics = []
    if data.has_schedule:
        # 집단 검사: 모든 Session이 같은 Schedule 1개를 공유
        schedule_atomic, schedule = await schedule_facade.create_schedule(
            center_id=center_id,
            schedule_type="assessment",
            start=to_utc_naive(data.scheduled_start),
            end=to_utc_naive(data.scheduled_end),
            member_id=data.counselor_id,
            room_id=data.room_id,
            memo=data.memo,
        )
        schedule_atomics.append(schedule_atomic)
        schedule_id = schedule.id

        session_atomics, _ = await assessment_facade.create_sessions_bulk(
            BulkSessionCreationRequest(
                center_id=center_id,
                case_ids=case_ids,
                schedule_id=schedule.id,
            )
        )

    # 일괄 생성 사실(bulk = 1 event + N atomics)
    await emit(
        uow,
        "assessment_case_created",
        event_group_id=event_group_id,
        atomics=[*case_atomics, *schedule_atomics, *session_atomics],
        center_id=center_id,
        actor_id=actor_id,
    )

    # 접수 안내·리마인드 SMS는 반응(sms_assessment_case_created / sms_assessment_session_reminder)이
    # 케이스·세션 atomic마다 fan-out으로 워커에서 처리(bulk 전용 분기 없음)

    return BatchAssessmentResponse(
        schedule_id=schedule_id,
        case_ids=case_ids,
        total_count=bulk_case_result.total_count,
        created_at=utc_now(),
    )


TOOL = {
    "name": "create_batch_assessment_handler",
    "permission": "write:assessment_case",
    "purpose": "여러 내담자에게 검사 케이스를 한 번에 일괄 생성한다.",
    "keywords": [
        "create batch assessment",
        "일괄 검사 생성",
        "검사 배치 생성",
        "단체 검사",
        "여러명 검사 배정",
        "검사 일괄 배포",
        "batch 검사",
    ],
    "boundaries": "다건 일괄 생성 전용. 내담자 1명은 create_individual_assessment_handler. 검사 '정의' 생성(create_admin_assessment)과 다르다.",
    "output": "일괄 생성된 검사 케이스 (BatchAssessmentResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_ids": {
                "description": "검사 대상 내담자 UUID 목록(최소 1명).",
                "items": {"type": "string"},
                "minItems": 1,
                "title": "내담자 목록",
                "type": "array",
            },
            "institution_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "연계 기관 UUID(선택).",
                "title": "기관",
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
            "assistant_ids": {
                "description": "참여 검사자 UUID 목록.",
                "items": {"type": "string"},
                "title": "참여 검사자",
                "type": "array",
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
        "required": ["client_ids", "assessment_ids", "counselor_id"],
    },
}
