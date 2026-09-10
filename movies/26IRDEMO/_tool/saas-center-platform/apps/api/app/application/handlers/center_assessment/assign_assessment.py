from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.center_assessment.schemas import CenterAssessmentResponse
from app.modules.assessment.facade import AssessmentFacade
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def assign_assessment_handler(
    *,
    center_id: str,
    assessment_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> CenterAssessmentResponse:
    facade = AssessmentFacade(uow)
    ca_atomic, center_assessment = await facade.assign_center_assessment(
        center_id=center_id,
        assessment_id=assessment_id,
    )

    # 검사명 조회 (알림/감사 로그용)
    assessments = await facade.get_assessments_by_ids([assessment_id])
    assessment_name = assessments[0].kor_name if assessments else assessment_id

    # 알림 발송은 reaction(routes.py "center_assessment_assigned")이 수행 — tx 밖·재시도 멱등
    await emit(
        uow,
        "center_assessment_assigned",
        event_group_id=event_group_id,
        atomics=[
            ca_atomic,
            AdminAuditAtomic(
                _act="assigned",
                _entity_name="center_assessment",
                _entity_id=assessment_id,
                _payload={
                    "data": {
                        "center_id": center_id,
                        "assessment_id": assessment_id,
                        "assessment_name": assessment_name,
                    }
                },
            ),
        ],
        center_id=center_id,
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return CenterAssessmentResponse.model_validate(center_assessment)


TOOL = {
    "name": "assign_assessment_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "특정 심리검사를 센터에 할당해 그 센터에서 사용할 수 있게 한다.",
    "keywords": [
        "assign assessment",
        "검사 할당",
        "검사 배정",
        "검사 추가",
        "센터 검사 등록",
        "assessment 할당",
        "검사 사용 설정",
        "검사 붙이기",
    ],
    "boundaries": "운영자가 검사를 센터에 '할당'해 사용 가능 상태로 만든다. 완전 해제는 unassign_assessment_handler, 할당된 검사의 사용 on/off 전환은 toggle_assessment_handler를 쓴다. 할당 시 센터 관리자에게 알림이 발송된다.",
    "output": "센터에 할당된 검사 (CenterAssessmentResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "검사를 할당할 센터의 UUID.",
            },
            "assessment_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 검사",
                "description": "센터에 할당할 심리검사의 UUID.",
            },
        },
        "required": ["center_id", "assessment_id"],
    },
}
