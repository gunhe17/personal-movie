from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import CreditRateConfigResponse


async def get_credit_rate_config_handler(
    uow: UnitOfWork,
) -> CreditRateConfigResponse | None:
    from app.modules.llm.credit_rate_config.repository import CreditRateConfigRepository

    repo = uow.repo(CreditRateConfigRepository)
    active = await repo.find_active()
    if not active:
        return None
    return CreditRateConfigResponse(
        tokens_per_credit=active.tokens_per_credit,
        effective_from=active.effective_from,
        changed_by=active.changed_by,
        reason=active.reason,
    )


TOOL = {
    "name": "get_credit_rate_config_handler",
    "permission": None,
    "purpose": "현재 적용 중인 토큰당 크레딧 환산율(몇 토큰이 1크레딧인지) 설정을 조회한다.",
    "keywords": [
        "환산율",
        "크레딧 환율",
        "토큰당 크레딧",
        "요금 설정",
        "크레딧 차감 비율",
        "토큰 대 크레딧",
        "현재 적용 환율",
        "단가 설정",
    ],
    "boundaries": "지금 활성화된 '환산율 설정값'(tokens_per_credit과 적용 시점·변경 사유)만 읽는 도구다. 이 환율을 바꾸려면 change_credit_rate_handler(운영자 전용)를 쓴다. 센터의 실제 잔액·사용량과는 무관하다 — 그건 get_credit_balance_handler / get_credit_usage_handler가 담당한다. 센터 인자가 없는 전역 설정 조회다.",
    "output": "현재 적용 중인 환산율 설정 (CreditRateConfigResponse). 없으면 null.",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
