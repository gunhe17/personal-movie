from __future__ import annotations

from datetime import datetime, timedelta

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.llm.credit_balance.events import CreditBalanceAtomic
from app.modules.llm.credit_balance.models import CreditBalance
from app.modules.llm.credit_balance.plan_config import (
    FREE_PURPOSES,
    PURPOSE_ESTIMATED_CREDITS,
)
from app.modules.llm.credit_balance.repository import CreditBalanceRepository
from app.modules.llm.credit_rate_config.repository import CreditRateConfigRepository
from app.modules.llm.credit_rate_config.services.get_tokens_per_credit import (
    GetTokensPerCreditService,
)
from app.modules.llm.schemas import (
    CreditBalanceResponse,
    CreditHistoryItem,
    CreditHistoryResponse,
    CreditUsageResponse,
    DailyPurposeUsage,
    DailyUsage,
    PURPOSE_LABELS,
    UsagePurposeBreakdown,
)
from app.modules.llm.credit_balance.services import (
    AdjustCreditService,
    ClearCreditService,
    FindActiveBalanceService,
    FindLastConsumedBalanceService,
    InitializeCreditService,
    RollCreditPeriodService,
    SetCreditUsedService,
    tokens_to_credits,
)
from app.modules.llm.llm_call.repository import LlmCallRepository
from app.modules.llm.llm_call.services import (
    AggregateCenterUsageService,
    AggregateDailyPurposeUsageService,
    ListRecentLlmCallsService,
)


class CreditFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def find_balance(
        self,
        center_id: str,
    ) -> tuple[list[CreditBalanceAtomic], CreditBalance | None]:
        repo = self._uow.repo(CreditBalanceRepository)
        row = await FindActiveBalanceService(repo).execute(center_id)
        atomics = []
        if row is None:
            lazy_svc = RollCreditPeriodService(repo)
            rolled = await lazy_svc.execute(center_id)
            if rolled:
                atomic, row = rolled
                atomics.append(atomic)
        return atomics, row

    async def clear_credit(
        self, center_id: str
    ) -> tuple[list[CreditBalanceAtomic], int]:
        repo = self._uow.repo(CreditBalanceRepository)
        return await ClearCreditService(repo).execute(center_id)

    async def initialize_credit(
        self,
        center_id: str,
        plan_type: str,
        period_start: datetime,
        period_end: datetime,
    ) -> tuple[CreditBalanceAtomic, CreditBalance]:
        repo = self._uow.repo(CreditBalanceRepository)
        svc = InitializeCreditService(repo)
        return await svc.execute(
            center_id=center_id,
            plan_type=plan_type,
            period_start=period_start,
            period_end=period_end,
        )

    async def adjust_credit(
        self,
        center_id: str,
        adjust_type: str,
        amount: int = 0,
    ) -> tuple[CreditBalanceAtomic, CreditBalance]:
        repo = self._uow.repo(CreditBalanceRepository)
        return await AdjustCreditService(repo).execute(
            center_id,
            adjust_type=adjust_type,
            amount=amount,
        )

    async def set_credit_used(
        self,
        center_id: str,
        credit_used: int,
    ) -> tuple[CreditBalanceAtomic | None, CreditBalance | None]:
        repo = self._uow.repo(CreditBalanceRepository)
        return await SetCreditUsedService(repo).execute(
            center_id, credit_used=credit_used
        )

    async def find_balance_with_response(
        self,
        center_id: str,
    ) -> tuple[list[CreditBalanceAtomic], CreditBalanceResponse | None]:
        # 읽기 전용 — GET에서 롤하지 않는다(phantom 방지). 롤은 사용·크론 경로만.
        row = await FindActiveBalanceService(
            self._uow.repo(CreditBalanceRepository)
        ).execute(center_id)
        if row is None:
            return [], None
        rate_repo = self._uow.repo(CreditRateConfigRepository)
        current_rate = await GetTokensPerCreditService(rate_repo).execute()
        return [], self._to_balance_response(row, tokens_per_credit=current_rate)

    async def balance_with_response(
        self, balance: CreditBalance
    ) -> CreditBalanceResponse:
        rate_repo = self._uow.repo(CreditRateConfigRepository)
        current_rate = await GetTokensPerCreditService(rate_repo).execute()
        return self._to_balance_response(balance, tokens_per_credit=current_rate)

    async def balance_response(self, balance: CreditBalance) -> CreditBalanceResponse:
        return await self.balance_with_response(balance)

    async def get_usage_with_response(
        self,
        center_id: str,
    ) -> tuple[list[CreditBalanceAtomic], CreditUsageResponse]:
        llm_repo = self._uow.repo(LlmCallRepository)
        rate_repo = self._uow.repo(CreditRateConfigRepository)
        current_rate = await GetTokensPerCreditService(rate_repo).execute()

        # 읽기 전용 — GET에서 롤하지 않는다(만료 구독 조회만으로 phantom 잔액이 생기던 버그).
        # 기간 롤은 sub-aware 경로만: 사용 직전 ensure_current_period · 크론 roll_center_period.
        cb_repo = self._uow.repo(CreditBalanceRepository)
        balance = await FindActiveBalanceService(cb_repo).execute(center_id)
        atomics: list = []
        is_active = balance is not None
        if balance is None:
            # 만료·비활성 — 마지막 소비 기간을 헤드라인·집계 스코프로 고정한다.
            # 활성 잔액 없을 때 date=None으로 두면 집계가 전체기간으로 새고(헤드라인 0/0과 모순),
            # 마지막 소비 기간으로 스코프하면 카드·상세가 "그 기간 실사용"으로 일관(만료 표시).
            balance = await FindLastConsumedBalanceService(cb_repo).execute(center_id)

        date_from = balance.period_start if balance else None
        date_to = balance.period_end if balance else None

        totals, by_purpose, daily = await AggregateCenterUsageService(llm_repo).execute(
            center_id,
            date_from=date_from,
            date_to=date_to,
        )

        daily_purpose_raw = await AggregateDailyPurposeUsageService(llm_repo).execute(
            center_id,
            date_from=date_from,
            date_to=date_to,
        )

        purpose_breakdowns = [
            UsagePurposeBreakdown(
                purpose=item["purpose"],
                purpose_label=PURPOSE_LABELS.get(
                    item["purpose"] or "", item["purpose"] or "기타"
                ),
                calls=item["calls"],
                total_tokens=item["total_tokens"],
                credits=item["credits"],
            )
            for item in by_purpose
            if item["total_tokens"] > 0 or item["credits"] > 0
        ]

        filled_daily = self._fill_daily_gaps(daily, date_from, date_to)

        daily_by_purpose = [
            DailyPurposeUsage(
                date=item["date"],
                purpose=item["purpose"],
                purpose_label=PURPOSE_LABELS.get(
                    item["purpose"] or "", item["purpose"] or "기타"
                ),
                calls=item["calls"],
                credits=item["credits"],
            )
            for item in daily_purpose_raw
        ]

        return atomics, CreditUsageResponse(
            is_active=is_active,
            plan_type=balance.plan_type if balance else None,
            credit_limit=balance.credit_limit if balance else 0,
            credit_used=balance.credit_used if balance else 0,
            # 만료(비활성)면 잔여=0 — 이월 안 되는 지난 기간 미사용분을 "지금 쓸 수 있는 것"처럼
            # 보이지 않게. 사용/한도는 이력으로 유지(504/1500), 가용은 0.
            credit_remaining=(
                max(0, balance.credit_limit - balance.credit_used)
                if (balance and is_active)
                else 0
            ),
            tokens_per_credit=current_rate,
            period_start=balance.period_start if balance else None,
            period_end=balance.period_end if balance else None,
            total_calls=totals["total_calls"],
            total_tokens=totals["total_input_tokens"] + totals["total_output_tokens"],
            active_members=totals.get("active_members", 0),
            by_purpose=purpose_breakdowns,
            daily_usage=filled_daily,
            daily_by_purpose=daily_by_purpose,
        )

    async def get_history_with_response(
        self,
        center_id: str,
        limit: int = 20,
    ) -> tuple[list[CreditBalanceAtomic], CreditHistoryResponse]:
        llm_repo = self._uow.repo(LlmCallRepository)

        atomics, balance = await self.find_balance(center_id)
        date_from = balance.period_start if balance else None

        rows = await ListRecentLlmCallsService(llm_repo).execute(
            center_id,
            limit=limit,
            date_from=date_from,
            exclude_purposes=FREE_PURPOSES,
        )

        # member_name은 크로스 모듈(center/person) — application handler가 enrich.
        items = [
            CreditHistoryItem(
                purpose=row.purpose,
                purpose_label=PURPOSE_LABELS.get(
                    row.purpose or "", row.purpose or "기타"
                ),
                credits=row.credits_charged
                if row.credits_charged is not None
                else tokens_to_credits(row.input_tokens + row.output_tokens),
                created_at=row.created_at,
                member_id=row.member_id,
                member_name=None,
            )
            for row in rows
        ]

        return atomics, CreditHistoryResponse(items=items)

    @staticmethod
    def _to_balance_response(
        row: CreditBalance,
        *,
        tokens_per_credit: int = 2000,
    ) -> CreditBalanceResponse:
        return CreditBalanceResponse(
            plan_type=row.plan_type,
            credit_limit=row.credit_limit,
            credit_used=row.credit_used,
            credit_remaining=max(0, row.credit_limit - row.credit_used),
            tokens_per_credit=tokens_per_credit,
            period_start=row.period_start,
            period_end=row.period_end,
            estimated_credits=PURPOSE_ESTIMATED_CREDITS,
        )

    @staticmethod
    def _fill_daily_gaps(
        daily: list[dict],
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> list[DailyUsage]:
        if not daily or not date_from or not date_to:
            return [
                DailyUsage(
                    date=item["date"],
                    tokens=item["tokens"],
                    calls=item["calls"],
                    credits=item.get("credits", 0),
                )
                for item in daily
            ]

        from datetime import date as date_type

        daily_by_date = {item["date"]: item for item in daily}
        filled: list[DailyUsage] = []
        current = date_from.date() if isinstance(date_from, datetime) else date_from
        end = date_to.date() if isinstance(date_to, datetime) else date_to
        # 미래 날짜를 채우지 않도록 오늘까지만
        today = date_type.today()
        if end > today:
            end = today

        while current <= end:
            date_str = current.isoformat()
            if date_str in daily_by_date:
                item = daily_by_date[date_str]
                filled.append(
                    DailyUsage(
                        date=date_str,
                        tokens=item["tokens"],
                        calls=item["calls"],
                        credits=item.get("credits", 0),
                    )
                )
            else:
                filled.append(DailyUsage(date=date_str, tokens=0, calls=0, credits=0))
            current += timedelta(days=1)

        return filled
