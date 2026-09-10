from datetime import datetime

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..facade import CreditFacade
from ..schemas import CreditBalanceResponse


async def initialize_credit_handler(
    center_id: str,
    plan_type: str,
    period_start: datetime,
    period_end: datetime,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> CreditBalanceResponse:
    facade = CreditFacade(uow)
    atomic, balance = await facade.initialize_credit(
        center_id=center_id,
        plan_type=plan_type,
        period_start=period_start,
        period_end=period_end,
    )
    await emit(
        uow,
        "credit_balance_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return await facade.balance_with_response(balance)


TOOL = {
    "name": "initialize_credit_handler",
    "permission": None,
    "purpose": "센터에 결제 플랜과 기간을 지정해 AI 크레딧 잔액을 처음 부여(초기화)한다.",
    "keywords": [
        "크레딧 초기화",
        "크레딧 부여",
        "플랜 설정",
        "구독 시작",
        "크레딧 발급",
        "한도 설정",
        "결제 기간 등록",
        "신규 충전",
    ],
    "boundaries": "센터에 잔액을 '처음 생성'하거나 새 결제 기간으로 세팅하는 쓰기 도구다. 이미 있는 잔액을 조회만 하려면 get_credit_balance_handler를 쓴다. 전역 환산율 정책 변경(change_credit_rate_handler)과 달리 특정 센터의 한도를 플랜에 맞춰 부여한다. 운영자 전용.",
    "output": "초기화된 크레딧 잔액 (CreditBalanceResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "크레딧을 부여할 센터(지점)의 고유 식별 번호 (UUID 문자열).",
            },
            "plan_type": {
                "type": "string",
                "title": "요금 플랜",
                "description": "적용할 요금 플랜 종류 (예: 'pro'). 플랜에 따라 크레딧 한도가 정해진다.",
                "enum": ["free", "starter", "pro", "enterprise"],
            },
            "period_start": {
                "type": "string",
                "format": "date-time",
                "title": "기간 시작",
                "description": "이 크레딧이 유효한 결제 기간의 시작 시각 (datetime).",
            },
            "period_end": {
                "type": "string",
                "format": "date-time",
                "title": "기간 종료",
                "description": "이 크레딧이 유효한 결제 기간의 종료 시각 (datetime).",
            },
        },
        "required": ["center_id", "plan_type", "period_start", "period_end"],
    },
}
