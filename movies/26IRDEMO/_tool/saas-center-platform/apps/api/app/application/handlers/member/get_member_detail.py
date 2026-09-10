from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException
from app.modules.center.member.schemas import MemberDetailResponse, PersonDetail
from app.modules.center.facade import MemberFacade
from app.modules.person.facade import PersonFacade
from app.modules.auth.facade import AccountFacade
from app.modules.role.facade import RoleFacade


async def get_member_detail_handler(
    center_id: str,
    member_id: str,
    uow: UnitOfWork,
) -> MemberDetailResponse:
    member_facade = MemberFacade(uow)
    person_facade = PersonFacade(uow)
    account_facade = AccountFacade(uow)
    role_facade = RoleFacade(uow)

    member = await member_facade.get_member_validated(member_id, center_id)

    person_map = await person_facade.get_persons_by_ids([member.person_id])
    person = person_map.get(member.person_id)

    if not person:
        raise EntityNotFoundException(f"Person을 찾을 수 없습니다: {member.person_id}")

    email = None
    if person.account_id:
        account_map = await account_facade.get_accounts_by_ids([person.account_id])
        account = account_map.get(person.account_id)
        if account:
            email = account.email

    role_map = await role_facade.get_roles_by_ids([member.role_id])
    role = role_map.get(member.role_id)

    person_detail = PersonDetail(
        id=person.id,
        name=person.name,
        phone=person.phone,
        gender=person.gender,
        birth=person.birth,
        email=email,
    )

    response = MemberDetailResponse(
        id=member.id,
        center_id=member.center_id,
        person_id=member.person_id,
        role_code=role.code if role else "Unknown",
        role_name=role.name if role else "Unknown",
        status=member.status,
        employment_type=member.employment_type,
        hire_date=member.hire_date,
        profile_image_url=member.profile_image_url,
        memo=member.memo,
        careers=member.careers,
        educations=member.educations,
        certifications=member.certifications,
        is_certified=getattr(person, "is_certified", False) or False,
        created_at=member.created_at,
        updated_at=member.updated_at,
        person=person_detail,
    )

    return response


TOOL = {
    "name": "get_member_detail_handler",
    "permission": "read:member",
    "purpose": "센터 멤버 한 명의 상세 정보(역할·고용형태·경력·학력·자격·개인정보)를 조회한다.",
    "keywords": [
        "get member",
        "멤버 조회",
        "직원 정보",
        "멤버 상세",
        "구성원 정보",
        "직원 상세",
        "멤버 프로필",
        "member 조회",
        "팀원 정보",
    ],
    "boundaries": "특정 멤버 1명의 전체 상세를 조회한다(읽기 전용). 여러 명 목록은 list_members_enriched_handler, 로그인한 본인 멤버는 get_my_member_handler, 활동 실적 지표는 get_member_metrics_handler, 수정은 update_member_with_person_handler를 쓴다.",
    "output": "멤버 상세 (MemberDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 멤버",
                "description": "조회할 멤버(센터 구성원)의 UUID. 현재 센터 범위 안에서 해석된다.",
            },
        },
        "required": ["member_id"],
    },
}
