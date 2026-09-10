# 활성 환율(tokens_per_credit) 조회 + 설정 부재 시 기본값 적용.
#
# fallback 은 정책이라 repo 가 아니라 service 가 소유한다. repo 는 find_active(사실)만 반환.
from app.modules.llm.credit_rate_config.repository import CreditRateConfigRepository

DEFAULT_TOKENS_PER_CREDIT = 2000


class GetTokensPerCreditService:
    def __init__(self, repo: CreditRateConfigRepository):
        self.repo = repo

    async def execute(self) -> int:
        config = await self.repo.find_active()
        return config.tokens_per_credit if config else DEFAULT_TOKENS_PER_CREDIT
