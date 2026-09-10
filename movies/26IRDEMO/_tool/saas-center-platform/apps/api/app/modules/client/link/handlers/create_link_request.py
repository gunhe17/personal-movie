from app.core.datetime_utils import to_utc_naive
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import ClientLinkRequestCreate, ClientLinkRequestResponse
from ...link_request.repository import ClientLinkRequestRepository
from ...link_request.services import CreateLinkRequestService


async def create_link_request_handler(
    *,
    event_group_id: uuid_str,
    data: ClientLinkRequestCreate,
    center_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> ClientLinkRequestResponse:
    create_service = CreateLinkRequestService(uow.repo(ClientLinkRequestRepository))
    atomic, request = await create_service.execute(
        center_id=center_id,
        person_id=data.person_id,
        phone=data.phone,
        requested_at=to_utc_naive(data.requested_at),
    )
    await emit(
        uow,
        "client_link_request_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


    return ClientLinkRequestResponse.model_validate(request)


TOOL = {
    "name": 'create_link_request_handler',
    "permission": "write:client",
    "purpose": '내담자 연동(연결) 요청을 생성한다.',
    "keywords": ['create link request', '연동 요청', '연결 신청', 'link 요청', '내담자 연결'],
    "boundaries": "내담자 연동 '요청' 생성. 승인/반려는 approve·reject_link_request_handler.",
    "output": '생성된 연동 요청 (ClientLinkRequestResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'person_id': {'description': '연동을 요청하는 Person의 UUID.', 'title': '요청 개인', 'type': 'string'},
            'phone': {'description': '매칭 키(Person.phone) — 이 번호로 내담자와 연동 매칭.', 'maxLength': 20, 'minLength': 1, 'title': '매칭 전화번호', 'type': 'string'},
            'requested_at': {'description': '요청 시각(UTC).', 'format': 'date-time', 'title': '요청 시각', 'type': 'string'},
        },
        "required": ['person_id', 'phone', 'requested_at'],
    },
}
