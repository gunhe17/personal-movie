from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import (
    InvalidOperationException,
    PermissionDeniedException,
    ConflictException,
)
from app.modules.event import emit
from ..schemas import ClientLinkRequestResponse
from ...link_request.repository import ClientLinkRequestRepository
from ...link_request.services import ApproveLinkRequestService
from ...profile.events import ClientAtomic
from ...profile.repository import ClientRepository


async def approve_link_request_handler(
    request_id: str,
    client_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> ClientLinkRequestResponse:
    link_repo = uow.repo(ClientLinkRequestRepository)
    client_repo = uow.repo(ClientRepository)

    # 호출자 센터로 스코프(타 센터 요청 차단)
    request = await link_repo.get_in_center(id=request_id, center_id=center_id)

    client = await client_repo.get_by_id(client_id)

    # role='client'는 연동 금지 — guardian/both만
    if client.role == "client":
        raise InvalidOperationException(
            "Cannot link Person to Client with role='client'. "
            "Only 'guardian' or 'both' roles are allowed."
        )

    if client.center_id != request.center_id:
        raise PermissionDeniedException("Client와 요청의 센터가 일치하지 않습니다")

    # 1 Person = 1 Client per center
    existing_link = await client_repo.find_by_person_in_center(
        center_id=request.center_id,
        person_id=request.person_id,
    )
    if existing_link:
        raise ConflictException(
            f"Person {request.person_id}는 이미 센터 {request.center_id}에 "
            f"연동되어 있습니다 (Client: {existing_link.id})"
        )

    approve_service = ApproveLinkRequestService(link_repo)
    request_atomic, approved_request = await approve_service.execute(
        request_id, client_id, center_id
    )

    updated_client = await client_repo.update_in_place(
        client_id, person_id=approved_request.person_id
    )
    client_atomic, _client = ClientAtomic.updated(
        client=updated_client,
        changed={"person_id": approved_request.person_id},
    )

    await emit(
        uow,
        "client_link_request_approved",
        event_group_id=event_group_id,
        atomics=[request_atomic, client_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return ClientLinkRequestResponse.model_validate(approved_request)


TOOL = {
    "name": "approve_link_request_handler",
    "permission": "write:client",
    "purpose": "내담자 연동 요청을 승인한다.",
    "keywords": [
        "approve link request",
        "연동 승인",
        "연결 요청 승인",
        "link 승인",
        "연동 허가",
    ],
    "boundaries": "내담자 연동 요청 '승인'. 반려는 reject_link_request_handler, 목록은 list_link_requests_handler.",
    "output": "승인된 연동 요청 (ClientLinkRequestResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "request_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 연동 요청",
                "description": "승인할 연동 요청의 UUID.",
            },
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "연동 대상 내담자",
                "description": "연동 대상 내담자의 UUID.",
            },
        },
        "required": ["request_id", "client_id"],
    },
}
