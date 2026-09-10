from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.center_assessment.schemas import CenterAssessmentResponse
from app.modules.assessment.facade import AssessmentFacade
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def toggle_assessment_handler(
    *,
    center_id: str,
    assessment_id: str,
    is_active: bool,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> CenterAssessmentResponse:
    atomic, center_assessment = await AssessmentFacade(uow).toggle_center_assessment(
        center_id=center_id,
        assessment_id=assessment_id,
        is_active=is_active,
    )

    await emit(
        uow,
        "center_assessment_toggled",
        event_group_id=event_group_id,
        atomics=[
            atomic,
            AdminAuditAtomic(
                _act="toggled",
                _entity_name="center_assessment",
                _entity_id=assessment_id,
                _payload={
                    "data": {
                        "center_id": center_id,
                        "assessment_id": assessment_id,
                        "is_active": is_active,
                    }
                },
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return CenterAssessmentResponse.model_validate(center_assessment)


TOOL = {
    "name": "toggle_assessment_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "센터에 할당된 검사의 활성/비활성 상태를 켜거나 끈다.",
    "keywords": [
        "toggle assessment",
        "검사 활성화",
        "검사 비활성화",
        "검사 켜기",
        "검사 끄기",
        "검사 상태 변경",
        "assessment 토글",
        "검사 사용 중지",
    ],
    "boundaries": "이미 할당된 검사의 사용 여부만 on/off 전환한다(is_active로 방향 지정). 새로 할당하려면 assign_assessment_handler, 센터에서 완전히 빼려면 unassign_assessment_handler를 쓴다.",
    "output": "상태가 전환된 센터 검사 (CenterAssessmentResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "대상 센터의 UUID.",
            },
            "assessment_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 검사",
                "description": "상태를 전환할 검사의 UUID.",
            },
            "is_active": {
                "type": "boolean",
                "title": "활성 여부",
                "description": "true면 활성화(사용), false면 비활성화(사용 중지).",
            },
        },
        "required": ["center_id", "assessment_id", "is_active"],
    },
}
