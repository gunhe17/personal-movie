from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import InvalidOperationException
from app.core.datetime_utils import to_utc_naive
from app.core.type import unset, uuid_str
from app.modules.event import emit

from app.modules.assessment.assessment_case.schemas import (
    AssessmentCaseUpdate,
    AssessmentCaseUpdateResponse,
    AssessmentCaseResponse,
    ScheduleUpdateInput,
    UpdateValidationResult,
)

from app.modules.assessment.facade import (
    AssessmentCaseFacade,
    AssessmentSessionFacade,
    AssessmentTaskFacade,
    AssessmentCaseParticipantFacade,
)
from app.modules.institution.facade import InstitutionFacade
from app.modules.schedule.facade import ScheduleFacade


async def update_assessment_case_handler(
    center_id: str,
    case_id: str,
    data: AssessmentCaseUpdate,
    force: bool,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> AssessmentCaseUpdateResponse:
    # force=False면 영향 분석만(dry-run) 반환. conflict 확인 후 force=True로 재요청해 실제 수정
    case_facade = AssessmentCaseFacade(uow)

    # 수정은 주담당 전용 — 참여 검사자는 열람만
    await case_facade.verify_case_writable(center_id, case_id, owner_scope)

    validation = await case_facade.validate_case_update(center_id, case_id, data)

    if not force:
        return AssessmentCaseUpdateResponse(validation=validation)

    if not validation.can_update:
        raise InvalidOperationException(
            "수정할 수 없는 충돌이 있습니다. 먼저 충돌을 해결하고 재시도하세요."
        )

    task_facade = AssessmentTaskFacade(uow)
    participant_facade = AssessmentCaseParticipantFacade(uow)
    session_facade = AssessmentSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)
    institution_facade = InstitutionFacade(uow)

    applied_changes = {}
    atomics: list = []

    if data.counselor_id is not None:
        changes, counselor_atomics = await _apply_counselor_change(
            center_id,
            case_id,
            data.counselor_id,
            validation,
            case_facade,
            schedule_facade,
        )
        applied_changes["counselor_changed"] = changes
        atomics.extend(counselor_atomics)

    if data.assessment_ids is not None:
        changes, task_atomics = await _apply_assessment_changes(
            center_id,
            case_id,
            data.assessment_ids,
            validation,
            case_facade,
            task_facade,
        )
        applied_changes["assessment_changes"] = changes
        atomics.extend(task_atomics)

    if data.set_id is not None:
        set_atomic, _ = await case_facade.update_set_summary(
            center_id, case_id, data.set_id
        )
        atomics.append(set_atomic)
        applied_changes["set_summary_updated"] = True

    if data.client_ids is not None or data.assistant_ids is not None:
        changes, participant_atomics = await _apply_participant_changes(
            center_id, case_id, validation, participant_facade
        )
        applied_changes["participant_changes"] = changes
        atomics.extend(participant_atomics)

    if data.institution_id is not None:
        # institution_summary는 Handler가 조회해 dict로 전달 — Facade는 타 모듈 미참조
        inst_summary = await institution_facade.get_summary(data.institution_id)
        inst_atomic, _ = await case_facade.update_institution_summary(
            center_id, case_id, inst_summary.model_dump()
        )
        atomics.append(inst_atomic)
        applied_changes["institution_summary_updated"] = True

    if data.schedule is not None:
        changes, schedule_atomics = await _apply_schedule_changes(
            center_id,
            case_id,
            data.schedule,
            validation,
            case_facade,
            session_facade,
            schedule_facade,
        )
        applied_changes["schedule_changes"] = changes
        atomics.extend(schedule_atomics)

    case_atomic, case = await case_facade.update_case_metadata(
        center_id, case_id, data.tags, data.is_final_report_required
    )

    await emit(
        uow,
        "assessment_case_updated",
        event_group_id=event_group_id,
        atomics=[case_atomic, *atomics],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentCaseUpdateResponse(
        case=AssessmentCaseResponse.model_validate(case),
        applied_changes=applied_changes,
    )


async def _apply_assessment_changes(
    center_id: str,
    case_id: str,
    new_assessment_ids: list[str],
    validation: UpdateValidationResult,
    case_facade: AssessmentCaseFacade,
    task_facade: AssessmentTaskFacade,
) -> tuple[dict, list]:
    changes = {}
    atomics: list = []

    tasks_to_cancel_ids = validation.affected_resources.get("tasks_to_cancel", [])
    if tasks_to_cancel_ids:
        cancelled_atomics, cancelled_tasks = await task_facade.cancel_tasks(
            case_id=case_id,
            assessment_ids=tasks_to_cancel_ids,
            reason="Case 수정으로 인한 자동 취소",
        )
        atomics.extend(cancelled_atomics)
        changes["cancelled_tasks"] = cancelled_tasks
    else:
        changes["cancelled_tasks"] = []

    tasks_to_create = validation.affected_resources.get("tasks_to_create", [])
    if tasks_to_create:
        execution_method = validation.affected_resources.get(
            "execution_method", "online"
        )
        task_atomics, created_tasks = await task_facade.create_tasks_for_case(
            center_id=center_id,
            case_id=case_id,
            assessment_ids=tasks_to_create,
            execution_method=execution_method,
        )
        atomics.extend(task_atomics)
        changes["created_tasks"] = created_tasks
    else:
        changes["created_tasks"] = []

    summary_atomic, _ = await case_facade.update_assessment_summary(
        center_id, case_id, new_assessment_ids
    )
    atomics.append(summary_atomic)
    changes["summary_updated"] = True

    return changes, atomics


async def _apply_participant_changes(
    center_id: str,
    case_id: str,
    validation: UpdateValidationResult,
    participant_facade: AssessmentCaseParticipantFacade,
) -> tuple[dict, list]:
    changes = {}
    atomics: list = []

    participants_to_unassign = validation.affected_resources.get(
        "participants_to_unassign", []
    )
    if participants_to_unassign:
        unassign_atomics, unassigned = await participant_facade.unassign_participants(
            case_id=case_id,
            participants_to_unassign=participants_to_unassign,
        )
        atomics.extend(unassign_atomics)
        changes["unassigned"] = unassigned
    else:
        changes["unassigned"] = []

    participants_to_add = validation.affected_resources.get("participants_to_add", [])
    if participants_to_add:
        add_atomics, added = await participant_facade.add_participants(
            center_id=center_id,
            case_id=case_id,
            participants_to_add=participants_to_add,
        )
        atomics.extend(add_atomics)
        changes["added"] = added
    else:
        changes["added"] = []

    return changes, atomics


async def _apply_counselor_change(
    center_id: str,
    case_id: str,
    new_counselor_id: str,
    validation: UpdateValidationResult,
    case_facade: AssessmentCaseFacade,
    schedule_facade: ScheduleFacade,
) -> tuple[dict, list]:
    changes = {}
    atomics = []

    counselor_atomic, _ = await case_facade.update_counselor_id(
        center_id, case_id, new_counselor_id
    )
    atomics.append(counselor_atomic)
    changes["counselor_updated"] = True

    # Session이 있으면 그 Schedule의 담당자(member_id)도 같이 바꿔준다
    schedules_to_update = validation.affected_resources.get(
        "schedules_to_update_member", []
    )
    if schedules_to_update:
        for schedule_update in schedules_to_update:
            schedule_atomic, _ = await schedule_facade.update_schedule(
                center_id=center_id,
                schedule_id=schedule_update["schedule_id"],
                member_id=schedule_update["new_member_id"],
            )
            atomics.append(schedule_atomic)
        changes["schedule_member_updated"] = True

    return changes, atomics


async def _apply_schedule_changes(
    center_id: str,
    case_id: str,
    schedule_data: ScheduleUpdateInput,
    validation: UpdateValidationResult,
    case_facade: AssessmentCaseFacade,
    session_facade: AssessmentSessionFacade,
    schedule_facade: ScheduleFacade,
) -> tuple[dict, list]:
    changes = {}
    atomics: list = []

    # 온라인 → 대면: Schedule + Session 신설
    if validation.affected_resources.get("schedules_to_create"):
        case = await case_facade.get_case_by_id(center_id, case_id)

        schedule_atomic, schedule = await schedule_facade.create_schedule(
            center_id=center_id,
            schedule_type="assessment",
            start=to_utc_naive(schedule_data.scheduled_start),
            end=to_utc_naive(schedule_data.scheduled_end),
            member_id=case.counselor_id,
            room_id=schedule_data.room_id,
            memo=schedule_data.memo,
        )
        atomics.append(schedule_atomic)

        session_atomics, _ = await case_facade.create_session_with_participants(
            center_id=center_id,
            case_id=case_id,
            schedule_id=schedule.id,
        )
        atomics.extend(session_atomics)

        changes["schedule_created"] = schedule.id
        changes["session_created"] = True

    # 대면 → 온라인: Session 취소 + Schedule 삭제
    elif validation.affected_resources.get("sessions_to_cancel"):
        session_ids = validation.affected_resources["sessions_to_cancel"]
        session_atomics, cancelled_count = await session_facade.cancel_sessions(
            session_ids
        )
        atomics.extend(session_atomics)
        changes["sessions_cancelled"] = cancelled_count

        # Schedule 삭제는 다른 active session이 참조하지 않을 때만
        schedule_id = validation.affected_resources.get("schedule_id_to_check")
        if schedule_id:
            active_count = await session_facade.count_active_sessions_by_schedule(
                schedule_id, exclude_session_ids=session_ids
            )
            if active_count == 0:
                schedule_deleted_atomics, _ = await schedule_facade.delete_schedules(
                    [schedule_id]
                )
                atomics.extend(schedule_deleted_atomics)
                changes["schedule_deleted"] = schedule_id

    # 대면 일정 변경
    elif validation.affected_resources.get("schedules_to_update"):
        for schedule_update in validation.affected_resources["schedules_to_update"]:
            schedule_atomic, _ = await schedule_facade.update_schedule(
                center_id=center_id,
                schedule_id=schedule_update["schedule_id"],
                start=to_utc_naive(schedule_update["start"]),
                end=to_utc_naive(schedule_update["end"]),
                room_id=schedule_update["room_id"]
                if schedule_update["room_id"] is not None
                else unset,
                memo=schedule_update["memo"]
                if schedule_update["memo"] is not None
                else unset,
            )
            atomics.append(schedule_atomic)

        changes["schedules_updated"] = len(
            validation.affected_resources["schedules_to_update"]
        )

    return changes, atomics


TOOL = {
    "name": "update_assessment_case_handler",
    "permission": "write:assessment_case",
    "purpose": "검사 케이스의 정보를 수정한다.",
    "keywords": [
        "update assessment case",
        "검사 케이스 수정",
        "케이스 변경",
        "검사 정보 수정",
        "평가 수정",
    ],
    "boundaries": "검사 '케이스' 수정. force=True면 충돌(예: 일정 충돌)을 무시하고 강행. 취소 철회는 revert_cancel_case_handler, 삭제는 delete_assessment_case_handler.",
    "output": "수정된 검사 케이스 (AssessmentCaseUpdateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "수정할 검사 케이스의 UUID.",
            },
            "force": {
                "type": "boolean",
                "title": "강제 수정",
                "description": "true면 충돌(예: 일정 충돌)을 무시하고 강행.",
            },
            "counselor_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "담당 검사자(메인) UUID(미지정 시 유지).",
                "title": "담당 검사자",
            },
            "assessment_ids": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "검사 UUID 목록(전체 교체, 미지정 시 유지).",
                "title": "검사 목록",
            },
            "set_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "검사 세트 UUID(미지정 시 유지).",
                "title": "검사 세트",
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
            "assistant_ids": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "보조 검사자 UUID 목록(미지정 시 유지).",
                "title": "보조 검사자",
            },
            "institution_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "연계 기관 UUID(미지정 시 유지).",
                "title": "기관",
            },
            "tags": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "태그 목록(미지정 시 유지).",
                "title": "태그",
            },
            "is_final_report_required": {
                "anyOf": [{"type": "boolean"}, {"type": "null"}],
                "default": None,
                "description": "종합보고서 필요 여부(미지정 시 유지).",
                "title": "종합보고서 필요",
            },
            "schedule": {
                "anyOf": [{"$ref": "#/$defs/ScheduleUpdateInput"}, {"type": "null"}],
                "default": None,
                "description": "일정 수정 정보",
            },
        },
        "$defs": {
            "ScheduleUpdateInput": {
                "properties": {
                    "has_schedule": {
                        "description": "일정 사용 여부",
                        "title": "Has Schedule",
                        "type": "boolean",
                    },
                    "scheduled_start": {
                        "anyOf": [
                            {"format": "date-time", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "일정 시작 시간",
                        "title": "Scheduled Start",
                    },
                    "scheduled_end": {
                        "anyOf": [
                            {"format": "date-time", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "일정 종료 시간",
                        "title": "Scheduled End",
                    },
                    "room_id": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "장소 ID",
                        "title": "Room Id",
                    },
                    "memo": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "메모",
                        "title": "Memo",
                    },
                },
                "required": ["has_schedule"],
                "title": "ScheduleUpdateInput",
                "type": "object",
            }
        },
        "required": ["case_id", "force"],
    },
}
