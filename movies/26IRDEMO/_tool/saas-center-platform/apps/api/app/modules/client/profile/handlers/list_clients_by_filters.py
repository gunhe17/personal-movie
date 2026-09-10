from ..schemas import ClientRole
from datetime import date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.profile_facade import ProfileFacade


async def list_clients_by_filters_handler(
    center_id: str,
    name: str | None,
    phone: str | None,
    birthdate: date | None,
    role: str | None,
    uow: UnitOfWork,
):
    facade = ProfileFacade(uow)
    result = await facade.list_by_filters_with_response(
        center_id, name, phone, birthdate, role
    )
    return result


TOOL = {
    "name": "list_clients_by_filters_handler",
    "permission": "read:client",
    "purpose": "내담자를 이름·전화·생년월일·역할로 검색한다.",
    "keywords": ["내담자 검색", "고객 찾기", "client 검색", "이름으로 검색"],
    "boundaries": "조건으로 내담자 검색(읽기). 전체 목록은 list_with_relations_handler.",
    "output": "검색된 내담자 목록 (ClientSummary 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "title": "이름",
                "description": "이름 부분 검색(선택).",
            },
            "phone": {
                "type": "string",
                "title": "전화번호",
                "description": "전화번호 정확 검색(선택).",
            },
            "birthdate": {
                "type": "string",
                "format": "date",
                "title": "생년월일",
                "description": "생년월일(선택).",
            },
            "role": {
                "type": "string",
                "title": "역할 필터",
                "enum": [r.value for r in ClientRole],
                "description": "역할 필터(선택).",
            },
        },
        "required": [],
    },
}
