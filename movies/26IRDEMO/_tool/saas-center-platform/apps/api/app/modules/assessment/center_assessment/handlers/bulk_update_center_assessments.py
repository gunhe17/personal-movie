from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..repository import CenterAssessmentRepository
from ..services import BulkUpdateCenterAssessmentsService
from ..schemas import CenterAssessmentBulkUpdate, CenterAssessmentResponse


async def bulk_update_center_assessments_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: CenterAssessmentBulkUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> list[CenterAssessmentResponse]:
    repo = uow.repo(CenterAssessmentRepository)
    service = BulkUpdateCenterAssessmentsService(repo)

    atomics, entities = await service.execute(
        center_id=center_id,
        items=[(item.assessment_id, item.is_active) for item in data.items],
    )
    await emit(
        uow,
        "center_assessment_updated",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    return [CenterAssessmentResponse.model_validate(e) for e in entities]


TOOL = {
    "name": 'bulk_update_center_assessments_handler',
    "permission": "write:center_assessment",
    "purpose": '센터 할당 검사들을 일괄 수정한다.',
    "keywords": ['bulk update center assessments', '센터 검사 일괄 수정', '할당 검사 일괄', 'bulk update'],
    "boundaries": '센터 할당 검사 여러 건 일괄 변경. 단건 수정은 update_center_assessment_handler.',
    "output": '일괄 수정된 센터 할당 검사 목록 (CenterAssessmentResponse 배열).',
    "input_schema": {
        "type": "object",
        "properties": {
            'items': {'items': {'$ref': '#/$defs/CenterAssessmentBulkItem'}, 'title': '수정 항목 목록', 'type': 'array', 'description': '검사별 활성 여부 변경 항목 목록.'},
        },
        "$defs": {'CenterAssessmentBulkItem': {'properties': {'assessment_id': {'title': 'Assessment Id', 'type': 'string'}, 'is_active': {'title': 'Is Active', 'type': 'boolean'}}, 'required': ['assessment_id', 'is_active'], 'title': 'CenterAssessmentBulkItem', 'type': 'object'}},
        "required": ['items'],
    },
}
