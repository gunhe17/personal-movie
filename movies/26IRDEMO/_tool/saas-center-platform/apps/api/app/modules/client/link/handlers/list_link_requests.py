from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import ClientLinkRequestListResponse, ClientLinkRequestResponse
from ...link_request.repository import ClientLinkRequestRepository
from ...link_request.services import ListLinkRequestsService


async def list_link_requests_handler(
    center_id: str,
    owner_scope: str | None,
    status: str | None,
    skip: int,
    limit: int,
    uow: UnitOfWork,
) -> ClientLinkRequestListResponse:
    link_repo = uow.repo(ClientLinkRequestRepository)

    list_service = ListLinkRequestsService(link_repo)
    requests, page_meta = await list_service.execute(
        center_id=center_id,
        owner_scope=owner_scope,
        status=status,
        skip=skip,
        limit=limit,
    )

    return ClientLinkRequestListResponse.model_validate(
        {
            "items": [
                ClientLinkRequestResponse.model_validate(req) for req in requests
            ],
            **page_meta,
        }
    )


TOOL = {
    "name": "list_link_requests_handler",
    "permission": "write:client",
    "agent_exposed": False,  # read 의미인데 write 게이트 — 특수 read 심사 후보
    "purpose": "내담자 연동 요청 목록을 상태로 거르고 조회한다.",
    "keywords": ["연동 요청 목록", "연결 요청 조회", "link 목록"],
    "boundaries": "연동 요청 목록(읽기). 승인/반려는 approve·reject_link_request_handler.",
    "output": "연동 요청 목록 (ClientLinkRequestListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태",
                "description": "상태 필터(선택).",
            },
            "skip": {
                "type": "integer",
                "title": "오프셋",
                "description": "건너뛸 개수.",
            },
            "limit": {
                "type": "integer",
                "title": "최대 개수",
                "description": "가져올 최대 개수.",
            },
        },
        "required": [],
    },
}
