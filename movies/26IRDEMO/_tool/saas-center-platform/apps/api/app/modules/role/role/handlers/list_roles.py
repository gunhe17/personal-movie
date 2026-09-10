from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import RoleSummary
from ..repository import RoleRepository
from ... import ListRolesService


async def list_roles_handler(
    uow: UnitOfWork,
) -> list[RoleSummary]:
    role_repo = uow.repo(RoleRepository)
    list_service = ListRolesService(role_repo)
    roles = await list_service.execute()

    return [RoleSummary.model_validate(r) for r in roles]


TOOL = {
    "name": "list_roles_handler",
    "permission": None,
    "purpose": "역할 목록을 조회한다.",
    "keywords": ["역할 목록", "role 리스트", "권한 그룹 목록"],
    "boundaries": "역할 목록(읽기). 단건은 get_role_handler.",
    "output": "역할 목록 (RoleSummary 배열).",
    "input_schema": {"type": "object", "properties": {}, "required": []},
}
