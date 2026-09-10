from app.modules.counseling.counseling_session.models import CounselingSessionStatus
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.counseling.counseling_case.schemas import (
    ValidateUpdateRequest,
    ValidateUpdateResponse,
    ValidationError,
    ValidationWarning,
    CaseStatus,
)
from app.modules.counseling.facade import CounselingCaseFacade, CounselingSessionFacade
from app.modules.counseling.counseling_session_participant.schemas import (
    ParticipantType,
)


async def validate_case_update_handler(
    case_id: str,
    center_id: str,
    data: ValidateUpdateRequest,
    uow: UnitOfWork,
    owner_scope: str | None = None,
) -> ValidateUpdateResponse:
    # 실시간 검증용(입력 중 피드백) — 에러/경고를 분리해 반환, 데이터 변경 없음
    errors: list[ValidationError] = []
    warnings: list[ValidationWarning] = []

    case_facade = CounselingCaseFacade(uow)
    session_facade = CounselingSessionFacade(uow)

    # 없으면 raise (열람 범위 밖이어도 404 — 수정 전 검증이라 주담당 기준)
    await case_facade.get_case_by_id(case_id, center_id, owner_scope)

    sessions = await session_facade.get_sessions_by_case_ids([case_id])

    # 참여자별 소진 회기 수 (그룹 상담 고려 — 참여자 단위로 집계)
    participant_consumption: dict[str, int] = {}
    scheduled_count = 0

    for session in sessions:
        participants = await session_facade.get_participants_by_session_id(
            session_id=session.id,
            center_id=center_id,
        )

        for sp in participants:
            if sp.participant_type == ParticipantType.CLIENT.value:
                if sp.is_consumed:
                    participant_id = sp.participant_id
                    participant_consumption[participant_id] = (
                        participant_consumption.get(participant_id, 0) + 1
                    )

        if session.status == CounselingSessionStatus.SCHEDULED:
            scheduled_count += 1

    # 그룹 상담에서 가장 많이 소진한 참여자 기준 최대 소진 회기 수
    max_consumed = (
        max(participant_consumption.values()) if participant_consumption else 0
    )

    if data.total_sessions is not None:
        if data.total_sessions < max_consumed:
            errors.append(
                ValidationError(
                    field="total_sessions",
                    message=f"총 회기 수는 최소 {max_consumed}개 이상이어야 합니다. (현재 소진: {max_consumed}개)",
                    code="MIN_SESSIONS_VIOLATED",
                )
            )

    # 종결/취소하려면 예약된 세션이 없어야 함
    if data.status in [CaseStatus.COMPLETED, CaseStatus.CANCELLED]:
        if scheduled_count > 0:
            errors.append(
                ValidationError(
                    field="status",
                    message=f"예약된 회기가 {scheduled_count}개 있습니다. 모든 회기를 완료하거나 취소해야 합니다.",
                    code="HAS_SCHEDULED_SESSIONS",
                )
            )

    if data.reschedule_settings:
        rs = data.reschedule_settings

        if data.total_sessions is None:
            errors.append(
                ValidationError(
                    field="total_sessions",
                    message="회기 재설정 시 총 회기 수를 함께 입력해야 합니다.",
                    code="TOTAL_SESSIONS_REQUIRED",
                )
            )
        else:
            if rs.remaining_sessions_count < 1:
                errors.append(
                    ValidationError(
                        field="reschedule_settings.remaining_sessions_count",
                        message="재설정할 회기 개수는 최소 1개 이상이어야 합니다.",
                        code="MIN_RESCHEDULE_COUNT",
                    )
                )

            if data.total_sessions < max_consumed + rs.remaining_sessions_count:
                warnings.append(
                    ValidationWarning(
                        field="total_sessions",
                        message=f"총 회기 수({data.total_sessions})가 소진 회기({max_consumed}) + 재설정 회기({rs.remaining_sessions_count})보다 작습니다.",
                    )
                )

        if scheduled_count > 0:
            warnings.append(
                ValidationWarning(
                    field="reschedule_settings",
                    message=f"예약된 {scheduled_count}개 회기가 취소되고 새로 생성됩니다.",
                )
            )

    return ValidateUpdateResponse(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        max_consumed_count=max_consumed,
        scheduled_count=scheduled_count,
    )


TOOL = {
    "name": "validate_case_update_handler",
    "permission": "read:counseling",
    "purpose": "상담 케이스 수정 입력을 실제 반영 전에 실시간 검증해 막아야 할 오류와 주의할 경고를 분리해 반환한다.",
    "keywords": [
        "validate case update",
        "케이스 수정 검증",
        "입력 유효성",
        "실시간 검증",
        "수정 가능 여부",
        "오류 경고 확인",
        "사전 검증",
        "폼 검증",
        "validate",
    ],
    "boundaries": "데이터를 바꾸지 않고 케이스 수정 폼 입력을 점검하는 읽기 전용 도구다 — 총 회기 수가 소진 회기보다 작은지, 종결/취소인데 예약 회기가 남았는지 등을 검사해 오류/경고를 나눠 준다. 실제 수정을 적용하려면 update_case_handler를 쓴다. 회기 일괄 변경의 일정 충돌 점검은 validate_bulk_update_sessions_handler가 담당한다.",
    "output": "케이스 수정 입력 검증 결과, 오류·경고 (ValidateUpdateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "수정 입력을 검증할 상담 케이스의 UUID.",
            },
            "counselor_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "담당 상담사",
                "description": "변경할 담당 상담사 UUID(선택).",
            },
            "chief_complaint": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "주호소",
                "description": "변경할 주호소(선택).",
            },
            "memo": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "메모",
                "description": "변경할 메모(선택).",
            },
            "total_sessions": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "default": None,
                "title": "총 회기 수",
                "description": "변경할 총 회기 수(선택).",
            },
            "status": {
                "anyOf": [{"$ref": "#/$defs/CaseStatus"}, {"type": "null"}],
                "default": None,
            },
            "reschedule_settings": {
                "anyOf": [{"$ref": "#/$defs/RescheduleSettings"}, {"type": "null"}],
                "default": None,
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
