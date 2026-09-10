from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.form.schemas import FormResponse


async def get_instance_handler(
    instance_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> FormResponse:
    facade = FormFacade(uow)
    response = await facade.get_instance_with_response(
        instance_id=instance_id,
        center_id=center_id,
    )
    return response


TOOL = {
    "name": "get_instance_handler",
    "permission": "read:form_instance",
    "purpose": "폼 인스턴스 한 건을 조회한다.",
    "keywords": ["폼 조회", "인스턴스 상세", "설문 조회"],
    "boundaries": "단건 폼 인스턴스 조회(읽기). 목록은 list_instances_handler.",
    "output": "폼 인스턴스 상세 (FormResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "instance_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 폼",
                "description": "조회할 폼 인스턴스의 UUID.",
            },
        },
        "required": ["instance_id"],
    },
}
