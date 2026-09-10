from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import RoleResponse
from ..repository import RoleRepository
from ... import GetRoleService


async def get_role_handler(
    role_id: str,
    uow: UnitOfWork,
) -> RoleResponse:
    # Repository 획득
    role_repo = uow.repo(RoleRepository)

    # Service 실행: 조회 + 검증
    get_service = GetRoleService(role_repo)
    role = await get_service.execute(role_id)

    return RoleResponse.model_validate(role)


TOOL = {
    "name": "get_role_handler",
    "permission": None,
    "purpose": "역할(role) 한 건을 조회한다.",
    "keywords": ["역할 조회", "role 상세", "권한 그룹 조회"],
    "boundaries": "단건 역할 조회(읽기). 목록은 list_roles_handler.",
    "output": "역할 상세 (RoleResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "role_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 역할",
                "description": "조회할 역할의 UUID.",
            },
        },
        "required": ["role_id"],
    },
}
