from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..repository import PersonRepository
from ..schemas import PersonItem, PersonListResponse
from ..services.list_persons import ListPersonsService


async def list_persons_handler(
    page: int,
    size: int,
    uow: UnitOfWork,
) -> PersonListResponse:
    person_repo = uow.repo(PersonRepository)
    list_service = ListPersonsService(person_repo)
    persons, meta = await list_service.execute(page=page, size=size)

    return PersonListResponse(
        items=[PersonItem.model_validate(p) for p in persons],
        **meta,
    )


TOOL = {
    "name": "list_persons_handler",
    "permission": None,
    "purpose": "개인(person) 목록을 페이지 단위로 조회한다.",
    "keywords": ["개인 목록", "person 리스트", "인물 목록"],
    "boundaries": "개인 목록(읽기). 단건은 get_person_handler.",
    "output": "개인 목록 (PersonListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": ["page", "size"],
    },
}
