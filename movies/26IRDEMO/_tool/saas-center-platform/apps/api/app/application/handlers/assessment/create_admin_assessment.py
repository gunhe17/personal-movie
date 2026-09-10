from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentFacade
from app.modules.event import emit
from app.modules.platform_admin.assessment.schemas import (
    AdminAssessmentCreateRequest,
    AdminAssessmentDetailResponse,
)
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def create_admin_assessment_handler(
    *,
    data: AdminAssessmentCreateRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> AdminAssessmentDetailResponse:
    assessment = await AssessmentFacade(uow).create_assessment(
        code=data.code,
        version=data.version,
        kor_name=data.kor_name,
        eng_name=data.eng_name,
        assessment_type=data.assessment_type,
        description=data.description,
        duration=data.duration,
        age=data.age,
        status=data.status,
        workflow_type=data.workflow_type,
        external_url=data.external_url,
        supports_online=data.supports_online,
        definition=data.definition,
    )

    await emit(
        uow,
        "assessment_created",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="created",
            _entity_name="assessment",
            _entity_id=assessment.id,
            _payload={"data": {"id": assessment.id, "code": data.code, "kor_name": data.kor_name}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return AdminAssessmentDetailResponse.model_validate(assessment)


TOOL = {
    "name": 'create_admin_assessment_handler',
    "permission": None,
    "agent_exposed": False,
    "purpose": '운영자가 새 심리검사 정의를 검사 카탈로그에 생성한다.',
    "keywords": ['create admin assessment', '검사 생성', '검사 정의 추가', '심리검사 등록', '어드민 검사 만들기', '평가도구 생성', '검사 카탈로그 추가'],
    "boundaries": "운영자 전용 — 플랫폼 검사 '정의'를 만든다. 수정은 update_admin_assessment_handler, 센터에 쓰도록 붙이는 건 assign_assessment_handler. 내담자 검사 케이스 생성(create_individual/batch)과 다르다.",
    "output": '생성된 검사 정의 (AdminAssessmentDetailResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'code': {'maxLength': 50, 'minLength': 1, 'title': '검사 코드', 'type': 'string', 'description': '검사 식별 코드.'},
            'kor_name': {'maxLength': 255, 'minLength': 1, 'title': '한글명', 'type': 'string', 'description': '검사 한글 이름.'},
            'eng_name': {'maxLength': 255, 'minLength': 1, 'title': '영문명', 'type': 'string', 'description': '검사 영문 이름.'},
            'assessment_type': {'title': '검사 유형', 'type': 'string', 'description': '검사 유형(projective|intelligence|objective|developmental).'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '검사 설명(선택).'},
            'duration': {'anyOf': [{'minimum': 1, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '소요 시간', 'description': '예상 소요 시간(분, 선택).'},
            'age': {'anyOf': [{'maxLength': 100, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '대상 연령', 'description': '대상 연령대(선택).'},
            'status': {'default': 'private', 'title': '공개 상태', 'type': 'string', 'description': '공개 상태(기본 private).'},
            'version': {'default': '1.0', 'maxLength': 20, 'title': '버전', 'type': 'string', 'description': '검사 버전(기본 1.0).'},
            'workflow_type': {'default': 'self_report', 'title': '워크플로 유형', 'type': 'string', 'description': '진행 방식: self_report(자가응답)/external_service(외부 서비스, 기본 self_report).'},
            'external_url': {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '외부 URL', 'description': '외부 서비스형 검사 URL(선택).'},
            'supports_online': {'default': False, 'title': '온라인 지원', 'type': 'boolean', 'description': '온라인 실시 지원 여부(기본 False).'},
            'definition': {'additionalProperties': True, 'title': '검사 정의', 'type': 'object', 'description': '문항·채점 등 검사 정의 구조.'},
        },
        "required": ['code', 'kor_name', 'eng_name', 'assessment_type'],
    },
}
