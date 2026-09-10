from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..repository import CenterAssessmentRepository
from ..services import UpdateCenterAssessmentService
from ..schemas import CenterAssessmentUpdate, CenterAssessmentResponse


async def update_center_assessment_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    assessment_id: str,
    data: CenterAssessmentUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> CenterAssessmentResponse:
    repo = uow.repo(CenterAssessmentRepository)
    service = UpdateCenterAssessmentService(repo)

    atomic, entity = await service.execute(center_id, assessment_id, data.is_active)
    await emit(
        uow,
        "center_assessment_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return CenterAssessmentResponse.model_validate(entity)


TOOL = {
    "name": 'update_center_assessment_handler',
    "permission": "write:center_assessment",
    "purpose": '센터 할당 검사 한 건을 수정한다.',
    "keywords": ['센터 검사 수정', '할당 검사 변경', 'update center assessment'],
    "boundaries": '센터 할당 검사 단건 수정. 일괄은 bulk_update_center_assessments_handler.',
    "output": '수정된 센터 할당 검사 (CenterAssessmentResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'assessment_id': {'type': 'string', 'format': 'uuid', 'title': '대상 검사', 'description': '수정할 (센터 할당) 검사의 UUID.'},
            'is_active': {'title': '활성 여부', 'type': 'boolean', 'description': 'true면 센터에서 사용 활성화.'},
        },
        "required": ['assessment_id', 'is_active'],
    },
}
