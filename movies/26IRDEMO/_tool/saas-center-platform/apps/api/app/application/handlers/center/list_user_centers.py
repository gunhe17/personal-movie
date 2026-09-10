import math

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import (
    CenterFacade,
    MemberFacade,
    CenterApplicationFacade,
)
from app.modules.center.center.schemas import CenterSummary, CenterListResponse
from app.modules.center.center_application.schemas import CenterApplicationSummary


async def list_user_centers_handler(
    person_id: str,
    account_id: str,
    skip: int,
    limit: int,
    uow: UnitOfWork,
) -> CenterListResponse:
    member_facade = MemberFacade(uow)
    members = await member_facade.list_by_person(person_id)
    center_ids = [m.center_id for m in members]

    center_facade = CenterFacade(uow)
    center_map = await center_facade.get_active_by_ids(center_ids)

    all_centers = [center_map[cid] for cid in center_ids if cid in center_map]
    total = len(all_centers)
    centers = all_centers[skip : skip + limit]

    app_facade = CenterApplicationFacade(uow)
    all_applications = await app_facade.list_applications_by_account(account_id)
    applications = [a for a in all_applications if a.status == "PENDING"]

    page = (skip // limit) + 1 if limit > 0 else 1
    pages = math.ceil(total / limit) if limit > 0 else 1

    return CenterListResponse(
        centers=[CenterSummary.model_validate(c) for c in centers],
        applications=[CenterApplicationSummary.model_validate(a) for a in applications],
        total=total,
        page=page,
        size=limit,
        pages=pages,
    )


TOOL = {
    "name": "list_user_centers_handler",
    "agent_exposed": False,
    "permission": None,
    "purpose": "로그인한 사용자가 소속된 센터 목록을 조회한다.",
    "keywords": [
        "list user centers",
        "내 센터 목록",
        "소속 센터",
        "내가 속한 센터",
        "센터 전환 목록",
        "my centers",
    ],
    "boundaries": "'본인'이 멤버로 속한 센터들을 조회(읽기 전용, 센터 전환 등에 사용). 센터 신규 생성은 create_center_handler.",
    "output": "본인이 소속된 센터 목록 (CenterListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "skip": {
                "type": "integer",
                "title": "오프셋",
                "description": "건너뛸 개수(오프셋).",
            },
            "limit": {
                "type": "integer",
                "title": "최대 개수",
                "description": "가져올 최대 개수.",
            },
        },
        "required": ["skip", "limit"],
    },
}
