"""기간 정산 시임 배선 테스트.

과금 AI 소비 직전 조율층 시임(dispatch_job)에서 기간 정산이 핸들러보다 먼저
호출되는지 검증한다(과지급 창 폐쇄). 게이트웨이(CreditOps)는 정산을 모른다 —
모듈→application 역참조 제거(ai-calling.md 기간 정산 시임).
"""

import inspect

from unittest.mock import AsyncMock, patch

from app.application.jobs import dispatch as dispatch_mod
from app.application.jobs.dispatch import dispatch_job
from app.modules.llm.gateway.credit_quota_checker import CreditOps


async def test_dispatch_job_rolls_period_before_handler():
    order = []
    handler = AsyncMock(side_effect=lambda *a, **k: order.append("handler"))

    with patch.object(
        dispatch_mod.period_roller,
        "ensure_current_period",
        AsyncMock(side_effect=lambda cid: order.append(("roll", cid))),
    ):
        await dispatch_job(
            job_type="x",
            target_id="t1",
            center_id="c1",
            params=None,
            table={"x": handler},
        )

    # 정산이 잡 실행보다 먼저
    assert order == [("roll", "c1"), "handler"]
    handler.assert_awaited_once_with("t1", center_id="c1")


async def test_dispatch_job_unknown_type_does_not_roll():
    roll = AsyncMock()
    with patch.object(dispatch_mod.period_roller, "ensure_current_period", roll):
        try:
            await dispatch_job(
                job_type="nope",
                target_id="t1",
                center_id="c1",
                params=None,
                table={},
            )
        except ValueError:
            pass
        else:
            raise AssertionError("unknown job type must raise")
    roll.assert_not_awaited()


def test_credit_ops_has_no_roller_surface():
    # 게이트웨이 계층에 정산 표면이 없어야 한다 — 모듈→application 역참조 재유입 가드
    assert "roller" not in inspect.signature(CreditOps.__init__).parameters
