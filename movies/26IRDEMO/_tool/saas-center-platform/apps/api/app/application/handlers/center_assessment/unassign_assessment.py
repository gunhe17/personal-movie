from app.core.schemas import MessageResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentFacade
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def unassign_assessment_handler(
    *,
    center_id: str,
    assessment_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> MessageResponse:
    facade = AssessmentFacade(uow)
    ca_atomic, _removed = await facade.unassign_center_assessment(
        center_id=center_id,
        assessment_id=assessment_id,
    )

    # 검사명 조회 (알림/감사 로그용)
    assessments = await facade.get_assessments_by_ids([assessment_id])
    assessment_name = assessments[0].kor_name if assessments else assessment_id

    # 알림 발송은 reaction(routes.py "center_assessment_unassigned")이 수행 — tx 밖·재시도 멱등
    await emit(
        uow,
        "center_assessment_unassigned",
        event_group_id=event_group_id,
        atomics=[
            ca_atomic,
            AdminAuditAtomic(
                _act="unassigned",
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

    return MessageResponse(message="할당이 해제되었습니다.")


TOOL = {
    "name": "unassign_assessment_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "센터에 할당된 검사를 완전히 해제해 더 이상 쓸 수 없게 한다.",
    "keywords": [
        "unassign assessment",
        "검사 해제",
        "할당 해제",
        "검사 제거",
        "검사 빼기",
        "센터 검사 삭제",
        "assessment 해제",
        "검사 내리기",
    ],
    "boundaries": "검사를 센터에서 '완전히 해제'한다. 잠깐 끄기만 하려면 toggle_assessment_handler(비활성화), 새로 추가하려면 assign_assessment_handler를 쓴다. 해제 시 센터 관리자에게 알림이 발송된다.",
    "output": "해제 결과 메시지 (MessageResponse).",
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
                "description": "센터에서 해제할 검사의 UUID.",
            },
        },
        "required": ["center_id", "assessment_id"],
    },
}
