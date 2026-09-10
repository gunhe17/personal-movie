from datetime import date

from pydantic import BaseModel

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.center.member.schemas import MemberDetailResponse, PersonDetail
from app.modules.center.facade import MemberFacade
from app.modules.person.facade import PersonFacade
from app.modules.auth.facade import AccountFacade
from app.modules.role.facade import RoleFacade


class MemberSelfUpdate(BaseModel):
    # admin 필드(role_code, employment_type, hire_date, memo)는 아예 없음 → Pydantic이 422로 거부.
    name: str | None = None
    phone: str | None = None
    gender: str | None = None
    birth: date | None = None
    profile_image_url: str | None = None
    careers: list[str] | None = None
    educations: list[str] | None = None
    certifications: list[str] | None = None


async def update_my_member_handler(
    center_id: str,
    member_id: str,
    data: MemberSelfUpdate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> MemberDetailResponse:
    member_facade = MemberFacade(uow)
    person_facade = PersonFacade(uow)
    account_facade = AccountFacade(uow)
    role_facade = RoleFacade(uow)

    member_field_names = {
        "profile_image_url",
        "careers",
        "educations",
        "certifications",
    }
    member_fields = {
        key: getattr(data, key) for key in data.model_fields_set & member_field_names
    }
    member_atomic, member = await member_facade.update_member(
        member_id=member_id,
        center_id=center_id,
        changed=data.model_dump(
            mode="json",
            include=member_field_names,
            exclude_unset=True,
        ),
        **member_fields,
    )

    # 미전달(생략)=유지 / 명시 null=비우기 — model_fields_set으로 구분해 unset 관통
    person_fields = {
        k: getattr(data, k)
        for k in data.model_fields_set & {"name", "phone", "gender", "birth"}
    }
    for k in ("name", "phone"):
        # non-nullable 컬럼 — 명시 null은 비우기가 아니라 유지로 강등
        if k in person_fields and person_fields[k] is None:
            del person_fields[k]

    person_atomic, person = await person_facade.update_person(
        member.person_id,
        **person_fields,
    )

    await emit(
        uow,
        "member_updated",
        event_group_id=event_group_id,
        atomics=[member_atomic, person_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

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
    "name": "update_my_member_handler",
    "permission": "write:member",
    "purpose": "현재 로그인한 멤버가 자신의 프로필(이름·연락처·경력·학력·자격 등)을 수정한다.",
    "keywords": [
        "update my member",
        "내 정보 수정",
        "프로필 수정",
        "본인 정보 변경",
        "내 프로필 편집",
        "내 경력 수정",
        "내 프로필 업데이트",
        "my member update",
        "자기 정보 변경",
    ],
    "boundaries": "'본인'이 자기 멤버 프로필만 수정한다 — 역할·고용형태 같은 admin 필드는 바꿀 수 없다(그건 update_member_with_person_handler). 입력 인자 외 대상은 로그인한 본인·현재 센터 기준으로 정해진다.",
    "output": "수정된 내 멤버 정보 (MemberDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "이름",
                "description": "이름(미지정 시 유지).",
            },
            "phone": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "전화번호",
                "description": "전화번호(미지정 시 유지).",
            },
            "gender": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "성별",
                "description": "성별(미지정 시 유지).",
            },
            "birth": {
                "anyOf": [{"format": "date", "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "생년월일",
                "description": "생년월일(미지정 시 유지).",
            },
            "profile_image_url": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "프로필 이미지",
                "description": "프로필 이미지 URL(미지정 시 유지).",
            },
            "careers": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "경력",
                "description": "경력 목록(미지정 시 유지).",
            },
            "educations": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "학력",
                "description": "학력 목록(미지정 시 유지).",
            },
            "certifications": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "자격",
                "description": "자격 목록(미지정 시 유지).",
            },
        },
        "required": [],
    },
}
