from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException
from app.modules.role.facade import RoleFacade
from app.modules.center.facade import MemberFacade
from app.modules.person.facade import PersonFacade
from app.modules.auth.facade import AccountFacade
from .schemas import RoleMemberListResponse, RoleMemberSummary


async def list_role_members_handler(
    center_id: str,
    role_code: str,
    page: int,
    size: int,
    uow: UnitOfWork,
    search: str | None = None,
) -> RoleMemberListResponse:
    role_facade = RoleFacade(uow)
    member_facade = MemberFacade(uow)
    person_facade = PersonFacade(uow)
    account_facade = AccountFacade(uow)

    role = await role_facade.find_role_by_center_and_code(center_id, role_code)
    if not role:
        raise EntityNotFoundException(f"Role을 찾을 수 없습니다: {role_code}")

    person_ids_filter = None
    if search:
        persons = await person_facade.list_persons_by_name(search)
        person_ids_filter = [p.id for p in persons]

    skip = (page - 1) * size
    members, total = await member_facade.list_members_by_center(
        center_id,
        skip=skip,
        limit=size,
        role_id=role.id,
        person_ids=person_ids_filter,
    )

    if not members:
        return RoleMemberListResponse(items=[], total=0, page=page, size=size, pages=0)

    person_ids = [m.person_id for m in members]
    person_map = await person_facade.get_persons_by_ids(person_ids)

    account_ids = [p.account_id for p in person_map.values() if p.account_id]
    account_map = await account_facade.get_accounts_by_ids(account_ids)

    pages = (total + size - 1) // size if total > 0 else 1
    items = []
    for member in members:
        person = person_map.get(member.person_id)
        account = None
        if person and person.account_id:
            account = account_map.get(person.account_id)

        items.append(
            RoleMemberSummary(
                id=member.id,
                name=person.name if person else "Unknown",
                email=account.email if account else None,
                last_login_at=account.last_login_at if account else None,
                is_active=member.deleted_at is None,
            )
        )

    return RoleMemberListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


TOOL = {
    "name": "list_role_members_handler",
    "permission": "read:role",
    "purpose": "특정 역할에 속한 멤버 목록을 페이지 단위로 조회한다.",
    "keywords": [
        "list role members",
        "역할 멤버",
        "역할별 직원",
        "권한 보유자",
        "role 멤버 목록",
    ],
    "boundaries": "한 역할의 멤버 목록(읽기 전용). 역할 목록 자체는 list_center_roles_handler.",
    "output": "역할 멤버 목록 (RoleMemberListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "role_code": {
                "type": "string",
                "title": "역할 코드",
                "description": "멤버를 조회할 역할의 코드.",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "이름 검색어(선택).",
            },
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
        "required": ["role_code", "page", "size"],
    },
}
