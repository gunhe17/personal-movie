"""roll_center_period_handler 단위 테스트 — 기간 경계 정산 3분기 + no-op.

reserved 다운그레이드 / 체험 만료 / 미납 만료 / 아직 도래 안 함(no-op)을 검증한다.
협력자 = SubscriptionFacade(find_for_update·apply_plan_change·expire_subscription) + CreditFacade.
"""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.application.handlers.subscription import roll_center_period as mod
from app.modules.subscription.subscription.plan_config import (
    PlanType,
    SubscriptionStatus,
)

PAST = datetime(2000, 1, 1)
FUTURE = datetime(2999, 1, 1)


def _patches(sub):
    credit = MagicMock()
    credit_instance = credit.return_value
    credit_instance.initialize_credit = AsyncMock(return_value=(None, None))
    credit_instance.clear_credit = AsyncMock(return_value=([], 0))

    facade = MagicMock()
    facade_instance = facade.return_value
    facade_instance.find_for_update = AsyncMock(return_value=sub)
    facade_instance.expire_subscription = AsyncMock(return_value=(None, None))
    facade_instance.apply_plan_change = AsyncMock(
        return_value=(None, SimpleNamespace(
            plan="starter", current_period_start=PAST, current_period_end=FUTURE,
        ))
    )
    return credit, credit_instance, facade, facade_instance


@pytest.mark.asyncio
async def test_reserved_downgrade_applied():
    sub = SimpleNamespace(
        id="s1", center_id="c1", reserved_plan="starter",
        current_period_end=PAST, status="active", trial_end=None, plan="pro",
    )
    credit, credit_i, facade, facade_i = _patches(sub)
    with patch.object(mod, "CreditFacade", credit), patch.object(mod, "SubscriptionFacade", facade):
        await mod.roll_center_period_handler(
            uow=MagicMock(), center_id="c1", event_group_id="event-1"
        )

    facade_i.apply_plan_change.assert_awaited_once()
    assert facade_i.apply_plan_change.call_args.args[1] == PlanType.STARTER
    credit_i.initialize_credit.assert_awaited_once()
    assert credit_i.initialize_credit.call_args.args[1] == "starter"


@pytest.mark.asyncio
async def test_trial_expired_to_free():
    sub = SimpleNamespace(
        id="s1", center_id="c1", reserved_plan=None,
        current_period_end=FUTURE, status="trial", trial_end=PAST, plan="pro",
    )
    credit, credit_i, facade, facade_i = _patches(sub)
    facade_i.apply_plan_change.return_value = (None, SimpleNamespace(
        plan="free", current_period_start=PAST, current_period_end=FUTURE,
    ))
    with patch.object(mod, "CreditFacade", credit), patch.object(mod, "SubscriptionFacade", facade):
        await mod.roll_center_period_handler(
            uow=MagicMock(), center_id="c1", event_group_id="event-1"
        )

    assert facade_i.apply_plan_change.call_args.args[1] == PlanType.FREE
    # Free는 미터링 없음 → 지갑 삭제(init 아님)
    credit_i.clear_credit.assert_awaited_once_with("c1")
    credit_i.initialize_credit.assert_not_awaited()


@pytest.mark.asyncio
async def test_paid_expired_to_free():
    # 예약 없이 만료된 유료 구독 → Free 전환(배너 "무료 플랜으로 전환"과 일치). 옛 동작은
    # status=EXPIRED만 찍고 plan=pro 유지 = pro/expired 림보(화면엔 Pro인데 AI 차단)라 폐기.
    sub = SimpleNamespace(
        id="s1", center_id="c1", reserved_plan=None,
        current_period_end=PAST, status="active", trial_end=None, plan="pro",
    )
    credit, credit_i, facade, facade_i = _patches(sub)
    facade_i.apply_plan_change.return_value = (None, SimpleNamespace(
        plan="free", current_period_start=PAST, current_period_end=FUTURE,
    ))
    with patch.object(mod, "CreditFacade", credit), patch.object(mod, "SubscriptionFacade", facade):
        await mod.roll_center_period_handler(
            uow=MagicMock(), center_id="c1", event_group_id="event-1"
        )

    assert facade_i.apply_plan_change.call_args.args[1] == PlanType.FREE
    facade_i.expire_subscription.assert_not_awaited()
    # Free는 미터링 없음 → 지갑 삭제
    credit_i.clear_credit.assert_awaited_once_with("c1")
    credit_i.initialize_credit.assert_not_awaited()


@pytest.mark.asyncio
async def test_not_due_is_noop():
    sub = SimpleNamespace(
        id="s1", center_id="c1", reserved_plan=None,
        current_period_end=FUTURE, status="active", trial_end=None, plan="pro",
    )
    credit, credit_i, facade, facade_i = _patches(sub)
    with patch.object(mod, "CreditFacade", credit), patch.object(mod, "SubscriptionFacade", facade):
        await mod.roll_center_period_handler(
            uow=MagicMock(), center_id="c1", event_group_id="event-1"
        )

    facade_i.apply_plan_change.assert_not_awaited()
    facade_i.expire_subscription.assert_not_awaited()
    credit_i.initialize_credit.assert_not_awaited()
    credit_i.clear_credit.assert_not_awaited()


@pytest.mark.asyncio
async def test_no_subscription_is_noop():
    credit, credit_i, facade, facade_i = _patches(None)
    with patch.object(mod, "CreditFacade", credit), patch.object(mod, "SubscriptionFacade", facade):
        await mod.roll_center_period_handler(
            uow=MagicMock(), center_id="c1", event_group_id="event-1"
        )

    credit_i.initialize_credit.assert_not_awaited()
