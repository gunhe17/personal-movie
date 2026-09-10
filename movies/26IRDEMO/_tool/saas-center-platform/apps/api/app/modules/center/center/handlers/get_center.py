from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterFacade
from ..schemas import CenterResponse


async def get_center_handler(
    center_id: str,
    uow: UnitOfWork,
) -> CenterResponse:
    facade = CenterFacade(uow)
    result = await facade.get_center_with_response(center_id)

    return result


TOOL = {
    "name": "get_center_handler",
    "permission": "read:center",
    "purpose": "센터 기본 정보를 조회한다.",
    "keywords": ["센터 조회", "센터 정보", "center 상세", "지점 정보"],
    "boundaries": "단건 센터 정보 조회(읽기). 수정은 update_center_handler.",
    "output": "센터 기본 정보 (CenterResponse).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
