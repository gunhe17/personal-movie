from app.infrastructure.persistence.database import AsyncSessionLocal
from .ai_gateway import AIGateway
from .credit_quota_checker import CreditOps


def create_ai_gateway() -> AIGateway:
    """크레딧 체크 + 차감이 통합된 AIGateway 생성.

    기간 정산은 게이트웨이 소관 아님 — 과금 소비 직전 조율층 시임이 수행(ai-calling.md).
    """
    ops = CreditOps(AsyncSessionLocal)
    return AIGateway(
        AsyncSessionLocal,
        quota=ops,
        deductor=ops,
    )
