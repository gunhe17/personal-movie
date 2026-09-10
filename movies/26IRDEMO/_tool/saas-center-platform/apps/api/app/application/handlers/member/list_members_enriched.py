from pydantic import BaseModel

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.member.schemas import MemberListSummary, PersonSummary
from app.modules.center.facade import MemberFacade
from app.modules.person.facade import PersonFacade
from app.modules.auth.facade import AccountFacade
from app.modules.role.facade import RoleFacade


class MemberListResponse(BaseModel):
    items: list[MemberListSummary]
    total: int
    page: int
    size: int
    pages: int


async def list_members_enriched_handler(
    center_id: str,
    page: int,
    size: int,
    uow: UnitOfWork,
    search: str | None = None,
    role_code: str | None = None,
) -> MemberListResponse:
    member_facade = MemberFacade(uow)
    person_facade = PersonFacade(uow)
    account_facade = AccountFacade(uow)
    role_facade = RoleFacade(uow)

    role_id: str | None = None
    if role_code:
        role = await role_facade.find_role_by_center_and_code(center_id, role_code)
        role_id = role.id if role else None

    person_ids_filter: list[str] | None = None
    if search:
        persons = await person_facade.list_persons_by_name(search)
        person_ids_filter = [p.id for p in persons]

    skip = (page - 1) * size
    members, total = await member_facade.list_members_by_center(
        center_id,
        skip=skip,
        limit=size,
        role_id=role_id,
        person_ids=person_ids_filter,
    )

    if not members:
        return MemberListResponse(items=[], total=0, page=page, size=size, pages=0)

    person_ids = [m.person_id for m in members]
    person_map = await person_facade.get_persons_by_ids(person_ids)

    account_ids = [p.account_id for p in person_map.values() if p.account_id]
    account_map = await account_facade.get_accounts_by_ids(account_ids)

    role_ids = list(set(m.role_id for m in members))
    role_map = await role_facade.get_roles_by_ids(role_ids)

    pages = (total + size - 1) // size if total > 0 else 1
    items = []

    for member in members:
        person = person_map.get(member.person_id)
        role = role_map.get(member.role_id)

        email = None
        if person and person.account_id:
            account = account_map.get(person.account_id)
            if account:
                email = account.email

        person_summary = PersonSummary(
            name=person.name if person else "Unknown",
            phone=person.phone if person else None,
            gender=person.gender if person else None,
            email=email,
        )

        items.append(
            MemberListSummary(
                id=member.id,
                role_code=role.code if role else "Unknown",
                role_name=role.name if role else "Unknown",
                status=member.status,
                employment_type=member.employment_type,
                color=member.color,
                memo=member.memo,
                is_active=member.status == "active" and member.deleted_at is None,
                person=person_summary,
                profile_image_url=member.profile_image_url,
                is_certified=bool(person.is_certified) if person else False,
                created_at=member.created_at,
            )
        )

    return MemberListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


TOOL = {
    "name": "list_members_enriched_handler",
    "agent_exposed": False,
    "permission": "read:member",
    "purpose": "센터 멤버 목록을 이름 검색·역할 필터로 거르고 페이지 단위로 조회한다.",
    "keywords": [
        "list members",
        "멤버 목록",
        "직원 목록",
        "구성원 목록",
        "멤버 검색",
        "직원 찾기",
        "팀원 목록",
        "역할별 멤버",
        "member 리스트",
    ],
    "boundaries": "여러 멤버를 요약 형태 목록으로 조회한다(읽기 전용). 한 명의 전체 상세는 get_member_detail_handler를 쓴다. 이름 검색(search)과 역할 코드(role_code) 필터를 지원한다.",
    "output": "멤버 목록 (MemberListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "멤버 이름 검색어. 비우면 검색 없이 전체.",
            },
            "role_code": {
                "type": "string",
                "title": "역할 필터",
                "description": "특정 역할(ADMIN·MANAGER·COUNSELOR)만 거를 역할 코드. 비우면 전체 역할.",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "가져올 페이지 번호. 1부터 시작.",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "한 페이지에 담을 멤버 수.",
            },
        },
        "required": ["page", "size"],
    },
}
