from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.subscription.subscription.schemas import PlanInfo, build_plan_list
from app.modules.subscription.subscription.plan_config import refresh_plan_config_cache


async def get_plans_handler(uow: UnitOfWork) -> list[PlanInfo]:
    await refresh_plan_config_cache(uow.session)
    return build_plan_list()


TOOL = {
    "name": "get_plans_handler",
    "permission": None,
    "purpose": "선택 가능한 구독 요금제 목록을 조회한다.",
    "keywords": ["요금제 목록", "플랜 조회", "plans", "구독 상품"],
    "boundaries": "가입 가능한 요금제 목록(읽기). 현재 구독은 get_subscription_handler.",
    "output": "요금제 목록 (PlanInfo 배열).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
