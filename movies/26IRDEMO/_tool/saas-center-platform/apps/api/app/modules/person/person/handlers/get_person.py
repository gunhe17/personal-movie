from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..repository import PersonRepository
from ..schemas import PersonResponse
from ..services.get_person import GetPersonService


async def get_person_handler(
    person_id: str,
    uow: UnitOfWork,
) -> PersonResponse:
    person_repo = uow.repo(PersonRepository)
    get_service = GetPersonService(person_repo)
    person = await get_service.execute(person_id)

    return PersonResponse.model_validate(person)


TOOL = {
    "name": "get_person_handler",
    "permission": None,
    "purpose": "개인 정보를 조회한다.",
    "keywords": ["개인 조회", "person 상세", "인물 정보"],
    "boundaries": "단건 개인 정보 조회(읽기). 수정은 update_person_handler.",
    "output": "개인 상세 (PersonResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "person_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 개인",
                "description": "조회할 개인의 UUID.",
            },
        },
        "required": ["person_id"],
    },
}
