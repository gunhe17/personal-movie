from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..facade import CreditFacade
from ..schemas import CreditUsageResponse


async def get_credit_usage_handler(
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: str,
    actor_id: str,
) -> CreditUsageResponse:
    facade = CreditFacade(uow)
    atomics, response = await facade.get_usage_with_response(center_id)
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
    "name": "get_credit_usage_handler",
    "permission": None,
    "purpose": "센터의 AI 크레딧 사용 통계(총 호출·토큰·목적별·일자별 추이)를 조회한다.",
    "keywords": [
        "크레딧 사용량",
        "사용 통계",
        "얼마나 썼어",
        "AI 사용 내역",
        "일별 사용량",
        "목적별 사용",
        "토큰 사용",
        "사용 추이",
        "리포트",
    ],
    "boundaries": "기간 안의 '소비 통계 집계'(총 호출수·토큰·목적별/일자별 분석)를 보는 도구다. 지금 남은 잔액만 빠르게 보려면 get_credit_balance_handler를 쓴다. 이 도구는 추세·breakdown용이고, 환율 설정(get_credit_rate_config_handler)이나 초기화(initialize_credit_handler)와는 무관하다.",
    "output": "크레딧 사용 통계 (CreditUsageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "사용 통계를 조회할 센터(지점)의 고유 식별 번호 (UUID 문자열).",
            },
        },
        "required": ["center_id"],
    },
}
