from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..facade import CreditFacade
from ..schemas import CreditBalanceResponse


async def get_credit_balance_handler(
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: str,
    actor_id: str,
) -> CreditBalanceResponse | None:
    facade = CreditFacade(uow)
    atomics, response = await facade.find_balance_with_response(center_id)
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
    "name": "get_credit_balance_handler",
    "permission": None,
    "purpose": "센터의 현재 AI 크레딧 잔액과 이번 결제 기간의 한도·사용량을 조회한다.",
    "keywords": [
        "크레딧 잔액",
        "남은 크레딧",
        "크레딧 얼마나 남았어",
        "AI 사용 한도",
        "크레딧 한도",
        "충전 잔량",
        "포인트 잔액",
        "이번 달 크레딧",
    ],
    "boundaries": "지금 시점의 '잔액 스냅샷'(한도·사용·남은 크레딧)을 보는 도구다. 기간별 사용 추이·목적별 통계는 get_credit_usage_handler를, 토큰당 크레딧 환산율 설정은 get_credit_rate_config_handler를 쓴다. 잔액 자체를 처음 부여(초기화)하려면 initialize_credit_handler를 사용한다.",
    "output": "크레딧 잔액 스냅샷 (CreditBalanceResponse). 없으면 null.",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "잔액을 조회할 센터(지점)의 고유 식별 번호 (UUID 문자열).",
            },
        },
        "required": ["center_id"],
    },
}
