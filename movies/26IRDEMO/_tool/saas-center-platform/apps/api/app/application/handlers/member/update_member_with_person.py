from datetime import date

from pydantic import BaseModel, field_validator, model_validator

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.modules.event import emit
from app.modules.center.member.schemas import (
    MemberDetailResponse,
    PersonDetail,
    EMPLOYMENT_TYPES,
)
from app.modules.center.facade import MemberFacade
from app.modules.person.facade import PersonFacade
from app.modules.auth.facade import AccountFacade
from app.modules.role.facade import RoleFacade
from app.modules.role.role.schemas import RoleCode


class MemberWithPersonUpdate(BaseModel):
    role_code: RoleCode | None = None
    employment_type: str | None = None
    hire_date: date | None = None
    memo: str | None = None
    profile_image_url: str | None = None
    careers: list[str] | None = None
    educations: list[str] | None = None
    certifications: list[str] | None = None
    name: str | None = None
    phone: str | None = None
    gender: str | None = None
    birth: date | None = None

    @field_validator("employment_type")
    @classmethod
    def validate_employment_type(cls, v: str | None) -> str | None:
        if v is not None and v not in EMPLOYMENT_TYPES:
            raise ValueError(f"employment_type은 {EMPLOYMENT_TYPES} 중 하나여야 합니다")
        return v

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        for field in ("role_code", "employment_type"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(
                    f"{field} cannot be null (omit the field to keep unchanged)"
                )
        return self


async def update_member_with_person_handler(
    center_id: str,
    member_id: str,
    data: MemberWithPersonUpdate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> MemberDetailResponse:
    member_facade = MemberFacade(uow)
    person_facade = PersonFacade(uow)
    account_facade = AccountFacade(uow)
    role_facade = RoleFacade(uow)

    role_id: str | None = None
    if data.role_code:
        role = await role_facade.find_role_by_center_and_code(
            center_id, data.role_code.value
        )
        if not role:
            raise EntityNotFoundException(f"Role not found: {data.role_code.value}")
        role_id = role.id

    if role_id is not None:
        current_member = await member_facade.get_member_validated(member_id, center_id)
        if role_id != current_member.role_id:
            roles_map = await role_facade.get_roles_by_ids(
                [current_member.role_id, role_id]
            )
            current_role = roles_map.get(current_member.role_id)
            if current_role and current_role.code == RoleCode.ADMIN.value:
                raise InvalidOperationException("관리자의 역할은 변경할 수 없습니다.")
            new_role = roles_map.get(role_id)
            if new_role and new_role.code == RoleCode.ADMIN.value:
                raise InvalidOperationException(
                    "관리자 역할은 다른 구성원에게 할당할 수 없습니다."
                )

    member_field_names = {
        "employment_type",
        "hire_date",
        "memo",
        "profile_image_url",
        "careers",
        "educations",
        "certifications",
    }
    member_fields = {
        key: getattr(data, key) for key in data.model_fields_set & member_field_names
    }
    if "role_code" in data.model_fields_set:
        member_fields["role_id"] = role_id
    member_atomic, member = await member_facade.update_member(
        member_id=member_id,
        center_id=center_id,
        changed=data.model_dump(
            mode="json",
            include=member_field_names | {"role_code"},
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
    "name": "update_member_with_person_handler",
    "permission": "write:member",
    "purpose": "센터 멤버의 역할·고용정보와 개인정보를 함께 수정한다(관리자용).",
    "keywords": [
        "update member with person",
        "멤버 수정",
        "직원 정보 수정",
        "멤버 정보 변경",
        "역할 변경",
        "멤버 업데이트",
        "직원 편집",
        "구성원 수정",
        "고용정보 변경",
    ],
    "boundaries": "관리자가 다른 멤버의 역할·고용형태·개인정보까지 수정하는 도구다. 본인이 자기 정보만 고치려면 update_my_member_handler(역할 등 admin 필드 없음)를 쓴다. 조회는 get_member_detail_handler.",
    "output": "수정된 멤버 상세 (MemberDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 멤버",
                "description": "수정할 멤버의 UUID. 현재 센터 범위 안에서 해석된다.",
            },
            "role_code": {
                "anyOf": [{"$ref": "#/$defs/RoleCode"}, {"type": "null"}],
                "default": None,
            },
            "employment_type": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "고용 형태",
                "description": "고용 형태(미지정 시 유지).",
            },
            "hire_date": {
                "anyOf": [{"format": "date", "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "입사일",
                "description": "입사일(미지정 시 유지).",
            },
            "memo": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "메모",
                "description": "메모(미지정 시 유지).",
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
        },
        "$defs": {
            "RoleCode": {
                "enum": ["ADMIN", "MANAGER", "COUNSELOR"],
                "title": "RoleCode",
                "type": "string",
            }
        },
        "required": ["member_id"],
    },
}
