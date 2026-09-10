from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..repository import CenterAssessmentRepository
from ..services import CreateCenterAssessmentService
from ..schemas import CenterAssessmentResponse


async def create_center_assessment_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    assessment_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> CenterAssessmentResponse:
    repo = uow.repo(CenterAssessmentRepository)
    service = CreateCenterAssessmentService(repo)

    atomic, entity = await service.execute(center_id, assessment_id)
    await emit(
        uow,
        "center_assessment_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return CenterAssessmentResponse.model_validate(entity)


TOOL = {
    "name": "create_center_assessment_handler",
    "permission": "write:center_assessment",
    "purpose": "검사를 센터에 할당(등록)한다.",
    "keywords": ["센터 검사 할당", "검사 등록", "create center assessment"],
    "boundaries": "검사를 센터에 할당한다. 목록은 list_center_assessments_handler, 수정은 update_center_assessment_handler.",
    "output": "센터에 할당된 검사 (CenterAssessmentResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "assessment_id": {'type': 'string', 'format': 'uuid', 'title': '대상 검사', 'description': '센터에 할당할 검사의 UUID.'},
        },
        "required": ["assessment_id"],
    },
}
