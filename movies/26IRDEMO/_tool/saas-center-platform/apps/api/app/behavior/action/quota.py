from typing import TYPE_CHECKING

from app.core.behavior import Action

if TYPE_CHECKING:
    from app.behavior.server import ServerMemory


class RequireQuota(Action):
    """AI 과금 진입 게이트(post-center). 정산→잔량 확인 순서는 act의 코드 순서가 강제한다.

    잔량 < purpose 추정치면 QuotaExceededException(402). 정산은 자체 세션 커밋·멱등·실패 삼킴.
    """

    def __init__(
        self,
        purpose: str,
    ) -> None:
        self.purpose = purpose

    def apply(
        self,
        m: "ServerMemory",
    ) -> None:
        m.activate(type(self))
        m.required_quota_purpose = self.purpose

    @classmethod
    async def act(
        cls,
        m: "ServerMemory",
    ) -> None:
        # lazy: application·llm 사슬 — behavior→application 순환 회피 (RequireFeature 선례)
        from app.application.subscription_period_roller import period_roller
        from app.modules.llm.facade.ai_facade import create_ai_facade

        await period_roller.ensure_current_period(m.center_id)
        await create_ai_facade().verify_quota(m.center_id, m.required_quota_purpose)
