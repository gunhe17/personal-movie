from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.llm.facade import CreditFacade
from app.modules.llm.schemas import CreditHistoryResponse
from app.modules.center.facade import MemberFacade
from app.modules.person.facade import PersonFacade
from app.modules.event import emit


async def get_credit_history_handler(
    center_id: str,
    uow: UnitOfWork,
    limit: int = 20,
    *,
    event_group_id: str,
    actor_id: str,
) -> CreditHistoryResponse:
    atomics, response = await CreditFacade(uow).get_history_with_response(
        center_id, limit=limit
    )

    member_ids = [it.member_id for it in response.items if it.member_id]
    if member_ids:
        member_map = await MemberFacade(uow).get_members_by_ids(list(set(member_ids)))
        person_map = await PersonFacade(uow).get_persons_by_ids(
            [m.person_id for m in member_map.values()]
        )
        for it in response.items:
            if not it.member_id:
                continue
            member = member_map.get(it.member_id)
            if member and member.person_id in person_map:
                it.member_name = person_map[member.person_id].name

    await emit(
        uow,
        "credit_period_rolled",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )
    return response


TOOL = {
    "name": "get_credit_history_handler",
    "permission": None,
    "purpose": "센터의 AI 크레딧 변동 이력을 조회한다.",
    "keywords": [
        "get credit history",
        "크레딧 이력",
        "크레딧 내역",
        "사용 이력",
        "충전 내역",
        "credit history",
        "크레딧 변동",
    ],
    "boundaries": "크레딧 '변동 이력'(충전·차감)을 조회(읽기 전용). 잔액·사용량 통계는 별도(get_credit_balance/usage).",
    "output": "크레딧 변동 이력 (CreditHistoryResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "title": "조회 개수",
                "description": "가져올 이력 개수 상한(기본 20).",
            },
        },
        "required": [],
    },
}
