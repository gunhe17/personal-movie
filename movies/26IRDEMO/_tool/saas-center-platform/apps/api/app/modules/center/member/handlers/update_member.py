from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import MemberUpdate, MemberResponse


async def update_member_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    member_id: str,
    data: MemberUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> MemberResponse:
    from app.modules.center.facade import MemberFacade

    facade = MemberFacade(uow)
    fields = {key: getattr(data, key) for key in data.model_fields_set}
    atomic, member = await facade.update_member(
        member_id=member_id,
        center_id=center_id,
        changed=data.model_dump(mode="json", exclude_unset=True),
        **fields,
    )
    await emit(
        uow,
        "member_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return MemberResponse.model_validate(member)


TOOL = {
    "name": "update_member_handler",
    "permission": None,
    "agent_exposed": False,  # 라우터 없음(내부) — 표면은 application update_member_with_person
    "purpose": "센터 멤버의 기본 정보를 수정한다.",
    "keywords": ["멤버 수정", "직원 정보 변경", "member 수정"],
    "boundaries": "모듈 기본 멤버 수정. 개인정보까지 함께 고치는 건 application의 update_member_with_person_handler.",
    "output": "수정된 멤버 (MemberResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 멤버",
                "description": "수정할 멤버의 UUID.",
            },
            "role_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "역할",
                "description": "부여할 역할의 UUID(미지정 시 유지).",
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
            "profile_image_url": {
                "anyOf": [{"maxLength": 500, "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "프로필 이미지",
                "description": "프로필 이미지 URL(미지정 시 유지).",
            },
            "memo": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "메모",
                "description": "메모(미지정 시 유지).",
            },
            "careers": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "경력 목록(문자열 배열, 미지정 시 유지).",
                "title": "경력",
            },
            "educations": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "학력 목록(문자열 배열, 미지정 시 유지).",
                "title": "학력",
            },
            "certifications": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "자격 목록(문자열 배열, 미지정 시 유지).",
                "title": "자격",
            },
        },
        "required": ["member_id"],
    },
}
