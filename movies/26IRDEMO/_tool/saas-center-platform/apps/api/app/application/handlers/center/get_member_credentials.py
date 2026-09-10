# 접근 정책: 본인이면 전체 자격 + legacy, 타인이면 verified만 (legacy는 빈 값)
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import MemberFacade
from app.modules.center.member.schemas import (
    MemberCredentialsLegacy,
    MemberCredentialsResponse,
)
from app.modules.person.facade import PersonFacade
from app.modules.person.credential.schemas import CredentialResponse


async def get_member_credentials_handler(
    center_id: str,
    member_id: str,
    requester_person_id: str,
    uow: UnitOfWork,
) -> MemberCredentialsResponse:
    member_facade = MemberFacade(uow)
    member = await member_facade.get_member_validated(member_id, center_id)

    is_self = member.person_id == requester_person_id

    credentials = await PersonFacade(uow).list_credentials_by_person(member.person_id)

    if not is_self:
        credentials = [c for c in credentials if c.status == "verified"]

    structured = [CredentialResponse.from_orm_model(c) for c in credentials]
    structured = await PersonFacade(uow).attach_credential_presigned_urls(structured)

    if is_self:
        legacy = MemberCredentialsLegacy(
            educations=member.educations or [],
            careers=member.careers or [],
            certifications=member.certifications or [],
        )
    else:
        legacy = MemberCredentialsLegacy()

    return MemberCredentialsResponse(
        structured=structured,
        legacy=legacy,
        is_self=is_self,
    )


TOOL = {
    "name": "get_member_credentials_handler",
    "permission": "read:member",
    "purpose": "센터 멤버의 자격(자격증·면허) 정보를 조회한다.",
    "keywords": [
        "get member credentials",
        "멤버 자격",
        "자격증 조회",
        "면허 확인",
        "직원 자격 정보",
        "자격 목록",
        "credential 조회",
    ],
    "boundaries": "한 멤버의 자격 정보를 조회한다(읽기 전용). 본인이면 전체+legacy까지, 타인이면 검증된 것만 보인다. 자격 검증 승인/반려는 approve_credential_handler·reject_credential_handler를 쓴다.",
    "output": "멤버 자격(자격증·면허) 정보 (MemberCredentialsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 멤버",
                "description": "자격 정보를 조회할 멤버의 UUID.",
            },
        },
        "required": ["member_id"],
    },
}
