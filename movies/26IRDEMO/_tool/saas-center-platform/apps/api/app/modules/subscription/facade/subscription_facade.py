from datetime import datetime

from app.core.type import unset, utc_dt
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import (
    PlanType,
    get_plan_config,
)
from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.repository import SubscriptionRepository
from app.modules.subscription.subscription_history.repository import (
    SubscriptionHistoryRepository,
)
from app.modules.subscription.subscription_payment.events import (
    SubscriptionPaymentAtomic,
)
from app.modules.subscription.subscription_payment.models import SubscriptionPayment
from app.modules.subscription.subscription_payment.repository import (
    SubscriptionPaymentRepository,
)
from app.modules.subscription.subscription.schemas import (
    SubscriptionResponse,
    SubscriptionHistoryItem,
    SubscriptionStatsResponse,
    build_plan_limits,
)
from app.modules.subscription.subscription.services import (
    CreateFreeSubscriptionService,
    CreateTrialSubscriptionService,
    GetSubscriptionService,
    UpgradePlanService,
    ApplyPlanChangeService,
    ClearQuotaExceededService,
    StartQuotaGraceService,
    GetSubscriptionStatsService,
    ReserveDowngradeService,
    CancelDowngradeService,
    TransitionStatusService,
    RequestPlanChangeService,
    ResolvePeriodService,
    ApprovePlanChangeService,
    RejectPlanChangeService,
    CountScheduledDowngradesService,
    EndQuotaGraceService,
    ExpireSubscriptionService,
    FindSubscriptionForUpdateService,
    GetSubscriptionForUpdateService,
    GrantTrialService,
    ListExpiredQuotaGraceService,
    ListExpiredWithReservationService,
    ListRollCandidatesService,
    ListStalePaymentStatesService,
    RestoreSubscriptionService,
)
from app.modules.subscription.subscription_history.services.count_churned_subscriptions import (
    CountChurnedSubscriptionsService,
)
from app.modules.subscription.subscription_history.services.list_subscription_history import (
    ListSubscriptionHistoryService,
)
from app.modules.subscription.subscription_history.services.record_subscription_history import (
    RecordSubscriptionHistoryService,
)
from app.modules.subscription.subscription_payment.services import (
    CreateSubscriptionPaymentService,
    ConfirmSubscriptionPaymentService,
    CancelSubscriptionPaymentService,
    AggregateMonthlyRevenueService,
    FindSubscriptionPaymentService,
    GetSubscriptionPaymentForUpdateService,
    GetSubscriptionPaymentStatsService,
    ListSubscriptionPaymentsService,
    ListSubscriptionPaymentsWithPageService,
    UpdateSubscriptionPaymentService,
)
from app.modules.subscription.subscription.services.change_plan import ChangePlanService


class SubscriptionFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _repo(self) -> SubscriptionRepository:
        return self._uow.repo(SubscriptionRepository)

    def _history_repo(self) -> SubscriptionHistoryRepository:
        return self._uow.repo(SubscriptionHistoryRepository)

    async def _record(self, transition) -> None:
        await RecordSubscriptionHistoryService(self._history_repo()).execute(
            transition.subscription_id,
            from_plan=transition.from_plan,
            to_plan=transition.to_plan,
            from_status=transition.from_status,
            to_status=transition.to_status,
            actor_type=transition.actor_type,
            reason=transition.reason,
            changed_at=transition.changed_at,
        )

    async def create_trial(
        self, center_id: str
    ) -> tuple[SubscriptionAtomic | None, Subscription]:
        # 크레딧 초기화는 호출처(application handler)가 CreditFacade로 조율한다.
        svc = CreateTrialSubscriptionService(self._repo())
        atomic, sub, transition = await svc.execute(center_id)
        if transition is not None:
            await self._record(transition)
        return atomic, sub

    async def get_subscription(self, center_id: str) -> Subscription:
        svc = GetSubscriptionService(self._repo())
        return await svc.execute(center_id)

    async def get_subscription_or_none(self, center_id: str) -> Subscription | None:
        svc = GetSubscriptionService(self._repo())
        return await svc.execute_or_none(center_id)

    def _payment_repo(self) -> SubscriptionPaymentRepository:
        return self._uow.repo(SubscriptionPaymentRepository)

    async def find_active(self, center_id: str) -> Subscription | None:
        return await GetSubscriptionService(self._repo()).execute_or_none(center_id)

    async def list_expired_with_reservation(self) -> list[Subscription]:
        return await ListExpiredWithReservationService(self._repo()).execute()

    async def apply_plan_change(
        self,
        center_id: str,
        new_plan: PlanType,
        *,
        actor_type: str = "user",
        reason: str = "upgrade",
        validate_upgrade: bool = False,
    ) -> tuple[SubscriptionAtomic, Subscription]:
        svc = ApplyPlanChangeService(self._repo())
        atomic, sub, transition = await svc.execute(
            center_id,
            new_plan,
            actor_type=actor_type,
            reason=reason,
            validate_upgrade=validate_upgrade,
            act="plan_applied",
        )
        await self._record(transition)
        return atomic, sub

    async def clear_quota_exceeded(
        self, center_id: str
    ) -> tuple[SubscriptionAtomic | None, Subscription | None]:
        return await ClearQuotaExceededService(self._repo()).execute(center_id)

    async def start_quota_grace(
        self, center_id: str
    ) -> tuple[SubscriptionAtomic | None, Subscription | None]:
        return await StartQuotaGraceService(self._repo()).execute(center_id)

    # 기간 정산 크론 표면 (cross-center batch + FOR UPDATE 직렬화)

    async def find_for_update(
        self,
        center_id: str,
    ) -> Subscription | None:
        return await FindSubscriptionForUpdateService(self._repo()).execute(center_id)

    async def list_roll_candidates(self) -> list[Subscription]:
        return await ListRollCandidatesService(self._repo()).execute()

    async def list_stale_payment_states(
        self,
        stale_days: int,
    ) -> list[Subscription]:
        return await ListStalePaymentStatesService(self._repo()).execute(
            stale_days=stale_days,
        )

    async def list_expired_quota_grace(self) -> list[Subscription]:
        return await ListExpiredQuotaGraceService(self._repo()).execute()

    async def expire_subscription(
        self,
        center_id: str,
        subscription_id: str,
    ) -> tuple[SubscriptionAtomic, Subscription]:
        return await ExpireSubscriptionService(self._repo()).execute(
            subscription_id=subscription_id,
            center_id=center_id,
        )

    async def restore_to_active(
        self,
        center_id: str,
        subscription_id: str,
    ) -> tuple[SubscriptionAtomic, Subscription]:
        return await RestoreSubscriptionService(self._repo()).execute(
            subscription_id=subscription_id,
            center_id=center_id,
        )

    async def end_quota_grace(
        self,
        center_id: str,
        subscription_id: str,
    ) -> tuple[SubscriptionAtomic, Subscription]:
        return await EndQuotaGraceService(self._repo()).execute(
            subscription_id=subscription_id,
            center_id=center_id,
        )

    async def find_payment_by_order_id(
        self, order_id: str
    ) -> SubscriptionPayment | None:
        return await FindSubscriptionPaymentService(self._payment_repo()).execute(
            toss_order_id=order_id,
        )

    async def update_payment(
        self,
        payment_id: str,
        *,
        act: str = "updated",
        status: str = unset,
        toss_payment_key: str | None = unset,
        method: str | None = unset,
        paid_at: utc_dt | None = unset,
        failed_reason: str | None = unset,
        raw_response: str | None = unset,
    ) -> tuple[SubscriptionPaymentAtomic | None, SubscriptionPayment | None]:
        return await UpdateSubscriptionPaymentService(self._payment_repo()).execute(
            payment_id,
            act=act,
            status=status,
            toss_payment_key=toss_payment_key,
            method=method,
            paid_at=paid_at,
            failed_reason=failed_reason,
            raw_response=raw_response,
        )

    async def get_subscription_with_response(
        self, center_id: str
    ) -> SubscriptionResponse:
        sub = await self.get_subscription(center_id)
        return self._to_response(sub)

    async def upgrade_with_response(
        self,
        center_id: str,
        new_plan: str,
        *,
        actor_type: str = "admin",
        reason: str = "upgrade",
    ) -> tuple[SubscriptionAtomic, SubscriptionResponse]:
        plan_type = PlanType(new_plan)
        svc = UpgradePlanService(self._repo())
        atomic, sub, transition = await svc.execute(
            center_id,
            plan_type,
            actor_type=actor_type,
            reason=reason,
        )
        await self._record(transition)
        return atomic, self._to_response(sub)

    async def change_plan_with_response(
        self,
        center_id: str,
        new_plan: str,
        *,
        actor_type: str = "admin",
        reason: str = "plan_change",
    ) -> tuple[SubscriptionAtomic, SubscriptionResponse]:
        plan_type = PlanType(new_plan)
        svc = ChangePlanService(self._repo())
        atomic, sub, transition = await svc.execute(
            center_id,
            plan_type,
            actor_type=actor_type,
            reason=reason,
        )
        await self._record(transition)
        return atomic, self._to_response(sub)

    async def grant_trial_with_response(
        self,
        center_id: str,
        *,
        actor_type: str = "admin",
        reason: str = "trial_granted",
        duration_days: int | None = None,
    ) -> tuple[SubscriptionAtomic, SubscriptionResponse]:
        from datetime import timedelta

        from app.core.datetime_utils import utc_now
        from app.modules.subscription.subscription.plan_config import (
            SubscriptionStatus,
            get_trial_plan,
            get_trial_duration_days,
            get_credit_cycle_days,
        )

        trial_plan = get_trial_plan()
        days = duration_days if duration_days is not None else get_trial_duration_days()
        cycle = get_credit_cycle_days()

        sub = await GetSubscriptionForUpdateService(self._repo()).execute(center_id)

        if sub.status == SubscriptionStatus.TRIAL:
            from app.core.exceptions import InvalidOperationException

            raise InvalidOperationException("이미 체험 상태입니다.")

        now = utc_now()
        old_plan = sub.plan

        atomic, sub = await GrantTrialService(self._repo()).execute(
            sub.id,
            center_id,
            trial_plan=trial_plan,
            trial_end=now + timedelta(days=days),
            period_start=now,
            period_end=now + timedelta(days=cycle),
        )

        await RecordSubscriptionHistoryService(self._history_repo()).execute(
            sub.id,
            from_plan=old_plan,
            to_plan=trial_plan,
            actor_type=actor_type,
            reason=reason,
            changed_at=now,
        )

        return atomic, self._to_response(sub)

    async def get_usage_overview(
        self,
        *,
        year: int | None = None,
        month: int | None = None,
    ) -> tuple[datetime, datetime, dict[str, int], int]:
        period_start, period_end = ResolvePeriodService().execute(
            year=year, month=month
        )
        by_plan, quota_exceeded = await GetSubscriptionStatsService(
            self._repo()
        ).execute()
        return period_start, period_end, by_plan, quota_exceeded

    async def get_stats_with_response(self) -> SubscriptionStatsResponse:
        svc = GetSubscriptionStatsService(self._repo())
        by_plan, exceeded = await svc.execute()
        total = sum(by_plan.values())
        scheduled = await CountScheduledDowngradesService(self._repo()).execute()

        churned_count = await CountChurnedSubscriptionsService(
            self._history_repo()
        ).execute()
        churn_rate = round((churned_count / total) * 100, 1) if total > 0 else 0.0

        return SubscriptionStatsResponse(
            by_plan=by_plan,
            quota_exceeded_count=exceeded,
            total=total,
            scheduled_downgrade_count=scheduled,
            churn_rate=churn_rate,
            churned_count=churned_count,
        )

    async def get_subscription_tab_data(
        self,
        center_id: str,
    ) -> tuple[SubscriptionResponse | None, list[SubscriptionHistoryItem]]:
        # 크레딧/AI 사용량 조립은 호출처(platform_admin handler)가 직접 조율한다.
        sub = await self.get_subscription_or_none(center_id)
        subscription = self._to_response(sub) if sub else None
        history = await self.get_history(center_id) if sub else []
        return subscription, history

    async def get_history(
        self,
        center_id: str,
        *,
        limit: int = 20,
    ) -> list[SubscriptionHistoryItem]:
        sub = await self.get_subscription(center_id)
        items = await ListSubscriptionHistoryService(self._history_repo()).execute(
            sub.id,
            limit=limit,
        )
        return [SubscriptionHistoryItem.model_validate(h) for h in items]

    async def initiate_upgrade(
        self,
        center_id: str,
        target_plan: str,
    ) -> tuple[SubscriptionPaymentAtomic, "InitiateUpgradeResponse"]:
        from app.modules.subscription.subscription.schemas import (
            InitiateUpgradeResponse,
        )

        plan_type = PlanType(target_plan)
        sub = await GetSubscriptionForUpdateService(self._repo()).execute(center_id)
        payment_repo = self._uow.repo(SubscriptionPaymentRepository)
        svc = CreateSubscriptionPaymentService(payment_repo)
        atomic, payment = await svc.execute(
            center_id,
            plan_type,
            subscription_id=sub.id,
            current_plan=sub.plan,
        )

        config = get_plan_config(plan_type)
        return atomic, InitiateUpgradeResponse(
            order_id=payment.toss_order_id,
            amount=payment.amount,
            plan=payment.plan,
            plan_label=config.label,
        )

    async def confirm_upgrade_by_plan(
        self,
        center_id: str,
        payment_key: str,
        order_id: str,
        amount: int,
        toss_response: dict,
    ) -> tuple[list, SubscriptionResponse]:
        payment_repo = self._uow.repo(SubscriptionPaymentRepository)

        confirm_svc = ConfirmSubscriptionPaymentService(payment_repo)
        payment_atomic, payment = await confirm_svc.execute(
            order_id,
            payment_key,
            amount,
            toss_response,
        )

        apply_svc = ApplyPlanChangeService(self._repo())
        sub_atomic, sub, transition = await apply_svc.execute(
            center_id,
            PlanType(payment.plan),
            actor_type="user",
            reason="payment_upgrade",
            act="upgraded",
        )

        await self._record(transition)
        return [payment_atomic, sub_atomic], self._to_response(sub)

    async def reserve_downgrade_with_response(
        self,
        center_id: str,
        target_plan: str,
    ) -> tuple[SubscriptionAtomic, SubscriptionResponse]:
        plan_type = PlanType(target_plan)
        svc = ReserveDowngradeService(self._repo())
        atomic, sub, transition = await svc.execute(center_id, plan_type)
        await self._record(transition)
        return atomic, self._to_response(sub)

    async def cancel_downgrade_with_response(
        self,
        center_id: str,
    ) -> tuple[SubscriptionAtomic, SubscriptionResponse]:
        svc = CancelDowngradeService(self._repo())
        atomic, sub, transition = await svc.execute(center_id)
        await self._record(transition)
        return atomic, self._to_response(sub)

    async def force_apply_downgrade_with_response(
        self,
        center_id: str,
    ) -> tuple[SubscriptionAtomic, SubscriptionResponse]:
        from app.core.exceptions import InvalidOperationException

        sub = await self.get_subscription(center_id)
        if not sub.reserved_plan:
            raise InvalidOperationException("예약된 다운그레이드가 없습니다.")

        apply_svc = ApplyPlanChangeService(self._repo())
        atomic, sub, transition = await apply_svc.execute(
            center_id,
            PlanType(sub.reserved_plan),
            actor_type="admin",
            reason="force_apply_downgrade",
            act="plan_applied",
        )

        await self._record(transition)
        return atomic, self._to_response(sub)

    async def list_payments(
        self,
        center_id: str,
        *,
        limit: int = 20,
    ) -> list["SubscriptionPaymentSummary"]:
        from app.modules.subscription.subscription.schemas import (
            SubscriptionPaymentSummary,
        )

        payments = await ListSubscriptionPaymentsService(self._payment_repo()).execute(
            center_id,
            limit=limit,
        )
        return [SubscriptionPaymentSummary.model_validate(p) for p in payments]

    async def list_payments_paginated_with_response(
        self,
        center_id: str,
        *,
        page: int = 1,
        size: int = 20,
    ) -> "PaymentListResponse":
        from app.modules.subscription.subscription.schemas import (
            PaymentListResponse,
            SubscriptionPaymentSummary,
        )

        items, meta = await ListSubscriptionPaymentsWithPageService(
            self._payment_repo()
        ).execute(
            center_id,
            page=page,
            size=size,
        )
        return PaymentListResponse(
            items=[SubscriptionPaymentSummary.model_validate(p) for p in items],
            total=meta["total"],
            page=page,
            size=size,
            pages=meta["pages"],
        )

    async def cancel_payment_with_response(
        self,
        center_id: str,
        payment_id: str,
        reason: str,
        toss_client: "PaymentClient",
    ) -> tuple[SubscriptionPaymentAtomic, "SubscriptionPaymentSummary"]:
        from app.core.exceptions import PermissionDeniedException
        from app.modules.subscription.subscription.schemas import (
            SubscriptionPaymentSummary,
        )

        payment_repo = self._uow.repo(SubscriptionPaymentRepository)
        cancel_svc = CancelSubscriptionPaymentService(payment_repo)

        payment = await GetSubscriptionPaymentForUpdateService(payment_repo).execute(
            payment_id,
        )
        if payment.center_id != center_id:
            raise PermissionDeniedException("해당 센터의 결제가 아닙니다.")

        if payment.toss_payment_key:
            await toss_client.cancel_payment(payment.toss_payment_key, reason)

        atomic, updated = await cancel_svc.execute(payment_id, reason)
        return atomic, SubscriptionPaymentSummary.model_validate(updated)

    async def get_payment_stats_with_response(
        self,
        *,
        year: int,
        month: int,
    ) -> "PaymentStatsResponse":
        from app.modules.subscription.subscription.schemas import PaymentStatsResponse

        (
            failed_count,
            confirmed_sum,
            revenue_by_plan,
        ) = await GetSubscriptionPaymentStatsService(self._payment_repo()).execute(
            year=year,
            month=month,
        )
        return PaymentStatsResponse(
            failed_count=failed_count,
            mrr=confirmed_sum,
            total_confirmed_this_month=confirmed_sum,
            revenue_by_plan=revenue_by_plan,
        )

    async def get_mrr_trend(self, months: int = 6) -> "MrrTrendResponse":
        from app.modules.subscription.subscription.schemas import (
            MrrTrendItem,
            MrrTrendResponse,
        )

        rows = await AggregateMonthlyRevenueService(self._payment_repo()).execute(
            months=months,
        )
        items = [MrrTrendItem(**row) for row in rows]
        return MrrTrendResponse(items=items)

    async def transition_status_with_response(
        self,
        center_id: str,
        target_status: str,
        *,
        actor_type: str = "system",
        reason: str,
        force: bool = False,
    ) -> tuple[SubscriptionAtomic, SubscriptionResponse]:
        from app.modules.subscription.subscription.plan_config import SubscriptionStatus

        status = SubscriptionStatus(target_status)
        svc = TransitionStatusService(self._repo())
        atomic, sub, transition = await svc.execute(
            center_id,
            status,
            actor_type=actor_type,
            reason=reason,
            force=force,
        )
        await self._record(transition)
        return atomic, self._to_response(sub)

    async def request_plan_change_with_response(
        self,
        center_id: str,
        target_plan: str,
    ) -> tuple[SubscriptionAtomic, SubscriptionResponse]:
        plan_type = PlanType(target_plan)
        svc = RequestPlanChangeService(self._repo())
        atomic, sub, transition = await svc.execute(center_id, plan_type)
        await self._record(transition)
        return atomic, self._to_response(sub)

    async def approve_plan_change_with_response(
        self,
        center_id: str,
    ) -> tuple[SubscriptionAtomic, SubscriptionResponse]:
        svc = ApprovePlanChangeService(self._repo())
        atomic, sub, transition = await svc.execute(center_id)
        await self._record(transition)
        return atomic, self._to_response(sub)

    async def reject_plan_change_with_response(
        self,
        center_id: str,
        *,
        reason: str = "plan_change_rejected",
    ) -> tuple[SubscriptionAtomic, SubscriptionResponse]:
        svc = RejectPlanChangeService(self._repo())
        atomic, sub, transition = await svc.execute(center_id, reason=reason)
        await self._record(transition)
        return atomic, self._to_response(sub)

    @staticmethod
    def _to_response(sub: Subscription) -> SubscriptionResponse:
        config = get_plan_config(sub.plan)
        return SubscriptionResponse(
            id=sub.id,
            center_id=sub.center_id,
            plan=sub.plan,
            status=sub.status,
            current_period_start=sub.current_period_start,
            current_period_end=sub.current_period_end,
            trial_end=sub.trial_end,
            is_quota_exceeded=sub.is_quota_exceeded,
            reserved_plan=sub.reserved_plan,
            reserved_at=sub.reserved_at,
            limits=build_plan_limits(config),
        )
