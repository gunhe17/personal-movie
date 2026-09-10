from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentFacade
from app.modules.event import emit
from app.modules.platform_admin.assessment.schemas import (
    AdminAssessmentUpdateRequest,
    AdminAssessmentDetailResponse,
)
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def update_admin_assessment_handler(
    *,
    assessment_id: str,
    data: AdminAssessmentUpdateRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> AdminAssessmentDetailResponse:
    assessment = await AssessmentFacade(uow).update_assessment(
        assessment_id,
        # 미전달 필드는 service unset 기본값 적용(omit vs None 구분)
        **data.model_dump(exclude_unset=True),
    )

    await emit(
        uow,
        "assessment_updated",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="updated",
            _entity_name="assessment",
            _entity_id=assessment_id,
            _payload={"data": {"id": assessment_id, "code": assessment.code, "kor_name": assessment.kor_name}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return AdminAssessmentDetailResponse.model_validate(assessment)


TOOL = {
    "name": 'update_admin_assessment_handler',
    "permission": None,
    "agent_exposed": False,
    "purpose": '운영자가 기존 검사 정의를 수정한다.',
    "keywords": ['update admin assessment', '검사 수정', '검사 정의 변경', '심리검사 편집', '평가도구 수정', '어드민 검사 수정'],
    "boundaries": "운영자 전용 — 검사 '정의' 수정. 생성은 create_admin_assessment_handler.",
    "output": '수정된 검사 정의 (AdminAssessmentDetailResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'assessment_id': {'type': 'string', 'format': 'uuid', 'title': '대상 검사 정의', 'description': '수정할 검사 정의의 UUID.'},
            'code': {'anyOf': [{'maxLength': 50, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '검사 코드', 'description': '검사 코드(미지정 시 유지).'},
            'version': {'anyOf': [{'maxLength': 20, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '버전', 'description': '검사 버전(미지정 시 유지).'},
            'kor_name': {'anyOf': [{'maxLength': 255, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '한글명', 'description': '한글 이름(미지정 시 유지).'},
            'eng_name': {'anyOf': [{'maxLength': 255, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '영문명', 'description': '영문 이름(미지정 시 유지).'},
            'assessment_type': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '검사 유형', 'description': '검사 유형(미지정 시 유지).'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '설명(미지정 시 유지).'},
            'duration': {'anyOf': [{'minimum': 1, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '소요 시간', 'description': '소요 시간(분, 미지정 시 유지).'},
            'age': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '대상 연령', 'description': '대상 연령대(미지정 시 유지).'},
            'status': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '공개 상태', 'description': '공개 상태(미지정 시 유지).'},
            'workflow_type': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '워크플로 유형', 'description': '진행 방식(미지정 시 유지).'},
            'external_url': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '외부 URL', 'description': '외부 서비스 URL(미지정 시 유지).'},
            'supports_online': {'anyOf': [{'type': 'boolean'}, {'type': 'null'}], 'default': None, 'title': '온라인 지원', 'description': '온라인 실시 지원 여부(미지정 시 유지).'},
            'definition': {'anyOf': [{'additionalProperties': True, 'type': 'object'}, {'type': 'null'}], 'default': None, 'title': '검사 정의', 'description': '문항·채점 정의(미지정 시 유지).'},
        },
        "required": ['assessment_id'],
    },
}
