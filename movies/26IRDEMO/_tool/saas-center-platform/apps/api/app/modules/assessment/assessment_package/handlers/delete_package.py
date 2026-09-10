from app.core.schemas import MessageResponse
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentPackageFacade
from app.modules.event import emit


async def delete_package_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    package_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> MessageResponse:
    facade = AssessmentPackageFacade(uow)
    atomic, result = await facade.delete_package(center_id, package_id)
    await emit(
        uow,
        "assessment_package_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return MessageResponse.model_validate(result)


TOOL = {
    "name": "delete_package_handler",
    "permission": "delete:assessment_case",
    "purpose": "검사 패키지를 삭제한다.",
    "keywords": ['delete package', "패키지 삭제", "검사 묶음 삭제", "package 삭제"],
    "boundaries": "검사 패키지 삭제. 조회는 get_package_handler.",
    "output": "삭제 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "package_id": {'type': 'string', 'format': 'uuid', 'title': '대상 패키지', 'description': '삭제할 검사 패키지의 UUID.'},
        },
        "required": ["package_id"],
    },
}
