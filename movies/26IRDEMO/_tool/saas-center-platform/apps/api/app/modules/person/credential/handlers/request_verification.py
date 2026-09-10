from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from ..repository import PersonCredentialRepository
from ..schemas import CredentialResponse
from ..services import RequestVerificationService


async def request_verification_handler(
    credential_id: str,
    person_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> CredentialResponse:
    # 상태 전이: unverified | rejected → pending.
    atomic, credential = await RequestVerificationService(
        uow.repo(PersonCredentialRepository)
    ).execute(credential_id, person_id)
    await emit(
        uow,
        "person_credential_verification_requested",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
    )
    return CredentialResponse.from_orm_model(credential)


TOOL = {
    "name": "request_verification_handler",
    "permission": None,
    "purpose": "등록한 자격의 검증(인증)을 요청한다.",
    "keywords": ["자격 검증 요청", "인증 신청", "verification 요청"],
    "boundaries": "자격 '검증 요청' 제출. 운영자 승인/반려는 application의 approve·reject_credential_handler.",
    "output": "검증 요청이 접수된 자격 (CredentialResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "credential_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 자격",
                "description": "검증을 요청할 자격의 UUID.",
            },
        },
        "required": ["credential_id"],
    },
}
