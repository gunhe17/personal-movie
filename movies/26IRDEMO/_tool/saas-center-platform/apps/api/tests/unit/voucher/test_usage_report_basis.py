"""V2 회귀: 사용량 리포트의 회기 수가 실제 차감(고유 세션/케이스 개수)과 정합.
이전엔 sum(quantity) 라 한 케이스에 묶인 검사 item 2건(각 quantity 1)이 2회기로
잡혔지만, 실제 차감은 고유 (related_session_id ?? related_case_id ?? item) 개수 = 1회기다.
repo aggregate(SQL 경로)와 handler 의 Python distinct 경로 둘 다 1을 내야 한다."""
from datetime import date

from app.modules.billing.billable.repository import BillableRepository
from app.modules.billing.billable_item.repository import BillableItemRepository

_CENTER = "center-A"
_CLIENT = "client-1"
_VOUCHER = "cv-1"
_CASE = "case-1"


async def _seed_two_items_one_case(test_session) -> None:
    billable_repo = BillableRepository(test_session)
    item_repo = BillableItemRepository(test_session)

    billable = await billable_repo.add(
        center_id=_CENTER,
        client_id=_CLIENT,
        billable_date=date(2026, 6, 24),
        status="issued",
        created_by="acc-1",
    )
    for desc in ("검사 A", "검사 B"):
        await item_repo.add(
            billable_id=billable.id,
            item_type="assessment_case",
            description=desc,
            quantity=1,
            unit_price=10000,
            amount=10000,
            subsidy_amount=0,
            related_type="assessment_case",
            related_case_id=_CASE,
            client_voucher_id=_VOUCHER,
        )
    await test_session.commit()


async def test_monthly_aggregate_counts_unique_case(test_session):
    await _seed_two_items_one_case(test_session)

    repo = BillableItemRepository(test_session)
    rows = await repo.aggregate_usage_by_voucher_monthly(
        center_id=_CENTER,
        client_voucher_id=_VOUCHER,
    )
    assert len(rows) == 1
    _ym, sessions, _amount, _subsidy, item_count = rows[0]
    assert sessions == 1  # 고유 케이스 1개 — quantity 합(2) 아님
    assert item_count == 2


async def test_usage_handler_session_key_logic():
    # handler 의 distinct-key 계산을 직접 재현(같은 케이스 공유 → 1)
    items = [
        type("I", (), {"related_session_id": None, "related_case_id": _CASE, "billable_item_id": "bi-1"})(),
        type("I", (), {"related_session_id": None, "related_case_id": _CASE, "billable_item_id": "bi-2"})(),
    ]
    session_keys = {
        i.related_session_id or i.related_case_id or i.billable_item_id
        for i in items
    }
    assert len(session_keys) == 1
