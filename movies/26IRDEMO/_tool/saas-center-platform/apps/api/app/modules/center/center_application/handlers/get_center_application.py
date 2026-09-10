from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import CenterApplicationResponse


async def get_center_application_handler(
    application_id: str,
    uow: UnitOfWork,
) -> CenterApplicationResponse:
    from app.modules.center.facade import CenterApplicationFacade

    facade = CenterApplicationFacade(uow)
    result = await facade.get_application_with_response(application_id)
    return result


TOOL = {
    "name": "get_center_application_handler",
    "permission": None,
    "purpose": "센터 개설 신청 한 건을 조회한다.",
    "keywords": ["센터 신청 조회", "개설 신청 상세", "application 조회"],
    "boundaries": "단건 신청 조회(읽기). 목록은 list_center_applications_handler.",
    "output": "센터 개설 신청 상세 (CenterApplicationResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "application_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 신청",
                "description": "조회할 센터 개설 신청의 UUID.",
            },
        },
        "required": ["application_id"],
    },
}
