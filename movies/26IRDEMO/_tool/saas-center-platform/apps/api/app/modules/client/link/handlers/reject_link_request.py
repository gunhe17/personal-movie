from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import ClientLinkRequestResponse
from ...link_request.repository import ClientLinkRequestRepository
from ...link_request.services import RejectLinkRequestService


async def reject_link_request_handler(
    request_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> ClientLinkRequestResponse:
    link_repo = uow.repo(ClientLinkRequestRepository)

    reject_service = RejectLinkRequestService(link_repo)
    atomic, rejected_request = await reject_service.execute(request_id, center_id)
    await emit(
        uow,
        "client_link_request_rejected",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return ClientLinkRequestResponse.model_validate(rejected_request)


TOOL = {
    "name": "reject_link_request_handler",
    "permission": "write:client",
    "purpose": "내담자 연동 요청을 반려한다.",
    "keywords": ['reject link request', "연동 반려", "연결 거절", "link 반려"],
    "boundaries": "연동 요청 '반려'. 승인은 approve_link_request_handler.",
    "output": "반려된 연동 요청 (ClientLinkRequestResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "request_id": {"type": "string", "format": "uuid", "title": "대상 연동 요청",
                           "description": "반려할 연동 요청의 UUID."},
        },
        "required": ["request_id"],
    },
}
