"""기간 경계 정산(roll_center_period) 실 DB 통합 테스트.

유닛(mock)이 못 잡는 실 동작 검증: apply_plan_change 전환, init_credit remove+add,
active partial-unique 제약, 쿼터 게이트 차단. FK가 없어 합성 center_id로 상태를 심는다.

test_session = imomtae_test DB(테이블별 truncate). DB 미기동 시 연결 에러로 실패한다
(pnpm db:up 필요).
"""

from datetime import datetime

import pytest

from app.core.exceptions import QuotaExceededException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.llm.credit_balance.plan_config import AIPurpose, PLAN_CREDIT_LIMITS
from app.modules.llm.credit_balance.repository import CreditBalanceRepository
from app.modules.llm.credit_balance.services import VerifyQuotaService
from app.application.handlers.subscription import roll_center_period_handler
from app.modules.subscription.subscription.repository import SubscriptionRepository

PAST = datetime(2000, 1, 1)
FUTURE = datetime(2999, 1, 1)


@pytest.mark.asyncio
async def test_trial_expired_rolls_to_free_and_clears_credit(test_session):
    uow = UnitOfWork(test_session)
    sub_repo = uow.repo(SubscriptionRepository)
    credit_repo = uow.repo(CreditBalanceRepository)
    center_id = "center-trial-expired"

    # setup: 체험(Pro) 만료 + Pro 크레딧 지갑
    await sub_repo.add_in_center(
        center_id=center_id, plan="pro", status="trial",
        current_period_start=PAST, current_period_end=FUTURE, trial_end=PAST,
    )
    await credit_repo.add(
        center_id=center_id, plan_type="pro",
        credit_limit=PLAN_CREDIT_LIMITS["pro"], credit_used=100,
        period_start=PAST, period_end=FUTURE,
    )
    await test_session.commit()

    # act
    await roll_center_period_handler(
        uow=uow, center_id=center_id, event_group_id="evt-trial-expired"
    )
    await test_session.commit()

    # assert: Free 전환 + Pro 지갑 삭제(미터링 없음 — 옛 Pro 잔량이 남지 않음)
    sub = await sub_repo.get_in_center(center_id)
    assert sub.plan == "free"
    bal = await credit_repo.find_active_by_center(center_id)
    assert bal is None

    # assert: 유료 purpose는 차단(fail-closed) — 과지급 창 완전 폐쇄
    with pytest.raises(QuotaExceededException):
        await VerifyQuotaService(credit_repo).execute(center_id, AIPurpose.CASE_ANALYSIS)


@pytest.mark.asyncio
async def test_reserved_downgrade_applied_with_new_plan_limit(test_session):
    uow = UnitOfWork(test_session)
    sub_repo = uow.repo(SubscriptionRepository)
    credit_repo = uow.repo(CreditBalanceRepository)
    center_id = "center-downgrade"

    # setup: 기간 만료 + Pro→Starter 예약, Pro 지갑 소진
    await sub_repo.add_in_center(
        center_id=center_id, plan="pro", status="active",
        current_period_start=PAST, current_period_end=PAST,
    )
    sub = await sub_repo.get_in_center(center_id)
    await sub_repo.update_in_center(
        subscription_id=sub.id, center_id=center_id, reserved_plan="starter", reserved_at=PAST,
    )
    await credit_repo.add(
        center_id=center_id, plan_type="pro",
        credit_limit=PLAN_CREDIT_LIMITS["pro"], credit_used=2400,
        period_start=PAST, period_end=PAST,
    )
    await test_session.commit()

    # act
    await roll_center_period_handler(
        uow=uow, center_id=center_id, event_group_id="evt-downgrade"
    )
    await test_session.commit()

    # assert: Starter 전환 + Starter 한도로 리셋(used=0)
    sub = await sub_repo.get_in_center(center_id)
    assert sub.plan == "starter"
    assert sub.reserved_plan is None
    bal = await credit_repo.find_active_by_center(center_id)
    assert bal.credit_limit == PLAN_CREDIT_LIMITS["starter"]
    assert bal.credit_used == 0


@pytest.mark.asyncio
async def test_active_within_period_is_noop(test_session):
    uow = UnitOfWork(test_session)
    sub_repo = uow.repo(SubscriptionRepository)
    credit_repo = uow.repo(CreditBalanceRepository)
    center_id = "center-active"

    await sub_repo.add_in_center(
        center_id=center_id, plan="pro", status="active",
        current_period_start=PAST, current_period_end=FUTURE,
    )
    await credit_repo.add(
        center_id=center_id, plan_type="pro",
        credit_limit=PLAN_CREDIT_LIMITS["pro"], credit_used=500,
        period_start=PAST, period_end=FUTURE,
    )
    await test_session.commit()

    await roll_center_period_handler(
        uow=uow, center_id=center_id, event_group_id="evt-active-noop"
    )
    await test_session.commit()

    # 변화 없음 — 지갑 그대로(used 보존)
    bal = await credit_repo.find_active_by_center(center_id)
    assert bal.plan_type == "pro"
    assert bal.credit_used == 500
