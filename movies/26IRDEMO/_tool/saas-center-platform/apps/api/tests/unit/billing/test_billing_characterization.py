"""U4 characterization: 돈 경로(청구 발행·납부 반영·상태전이·패키지 선결제 충돌)의
현행 동작을 고정한다 — rule-closure billing 사이클의 수정 전 안전망."""
from datetime import date, datetime, timezone

import pytest

from app.core.exceptions import ConflictException, InvalidOperationException
from app.modules.billing.billable.repository import BillableRepository
from app.modules.billing.billable.services.apply_payment_totals import (
    ApplyPaymentTotalsService,
)
from app.modules.billing.billable.services.complete_billable import CompleteBillableService
from app.modules.billing.billable.services.create_billable import CreateBillableService
from app.modules.billing.billable.services.update_billable import UpdateBillableService
from app.modules.billing.billable_item.repository import BillableItemRepository
from app.modules.billing.payment.repository import PaymentRepository
from app.modules.billing.payment.services.create_payment import CreatePaymentService

CENTER = "center-1"
CLIENT = "client-1"
ACCOUNT = "admin-1"


def item_row(**overrides) -> dict:
    row = {
        "item_type": "service",
        "item_id": None,
        "related_type": None,
        "related_case_id": None,
        "related_session_id": None,
        "client_voucher_id": None,
        "price_list_id": None,
        "description": "상담 1회",
        "quantity": 1,
        "unit_price": 100000,
        "provided_at": None,
        "memo": None,
    }
    row.update(overrides)
    return row


def make_service(session) -> CreateBillableService:
    return CreateBillableService(
        BillableRepository(session), BillableItemRepository(session)
    )


async def create_issued(session, **kwargs):
    defaults = dict(
        center_id=CENTER,
        client_id=CLIENT,
        billable_date=date.today(),
        due_date=None,
        memo=None,
        discount_amount=0,
        subsidy_amount=0,
        item_rows=[item_row()],
        account_id=ACCOUNT,
    )
    defaults.update(kwargs)
    _atomic, result = await make_service(session).execute(**defaults)
    return result


# 청구 발행

async def test_issue_computes_totals_and_status(
    test_session,
    cleanup_db,
):
    result = await create_issued(
        test_session,
        discount_amount=10000,
        item_rows=[item_row(quantity=2, unit_price=60000)],
    )
    b = result.billable
    assert b.status == "issued"
    assert b.issued_at is not None
    assert b.total_amount == 110000  # 2*60000 - 10000
    assert b.unpaid_amount == 110000
    assert b.paid_amount == 0
    assert len(result.items) == 1
    assert result.items[0].amount == 120000  # 항목 amount는 정가(qty*unit)


async def test_zero_total_auto_paid(
    test_session,
    cleanup_db,
):
    result = await create_issued(
        test_session, item_rows=[item_row(unit_price=0)]
    )
    assert result.billable.status == "paid"
    assert result.billable.unpaid_amount == 0


async def test_deductions_over_subtotal_rejected(
    test_session,
    cleanup_db,
):
    with pytest.raises(InvalidOperationException):
        await create_issued(
            test_session,
            discount_amount=150000,
            item_rows=[item_row(unit_price=100000)],
        )


async def test_subsidy_without_voucher_rejected(
    test_session,
    cleanup_db,
):
    with pytest.raises(InvalidOperationException):
        await create_issued(test_session, subsidy_amount=5000)


async def test_empty_items_rejected(
    test_session,
    cleanup_db,
):
    with pytest.raises(InvalidOperationException):
        await create_issued(test_session, item_rows=[])


async def test_subsidy_split_by_quantity_remainder_to_last(
    test_session,
    cleanup_db,
):
    result = await create_issued(
        test_session,
        subsidy_amount=10000,
        item_rows=[
            item_row(client_voucher_id="v-1", related_session_id="s-1",
                     related_type="counseling_session", quantity=1, unit_price=50000),
            item_row(client_voucher_id="v-1", related_session_id="s-2",
                     related_type="counseling_session", quantity=2, unit_price=50000),
        ],
    )
    # 분배: 1/3 몫 3333 → 첫 item, 나머지 6667 → 마지막 item
    assert result.items[0].subsidy_amount == 3333
    assert result.items[1].subsidy_amount == 6667
    assert result.voucher_amount_consumption == {"v-1": 10000}
    # 회기 차감 = 고유 세션 수
    assert result.voucher_consumption == {"v-1": 2}
    assert result.billable.total_amount == 150000 - 10000


async def test_voucher_consumption_case_unit_dedup(
    test_session,
    cleanup_db,
):
    # 같은 케이스의 검사 item 3개(세션 없음) → 1회기
    result = await create_issued(
        test_session,
        item_rows=[
            item_row(client_voucher_id="v-1", related_case_id="case-1",
                     related_type="assessment_session", unit_price=30000)
            for _ in range(3)
        ],
    )
    assert result.voucher_consumption == {"v-1": 1}


async def test_duplicate_counseling_session_in_request_rejected(
    test_session,
    cleanup_db,
):
    rows = [
        item_row(related_type="counseling_session", related_session_id="s-1"),
        item_row(related_type="counseling_session", related_session_id="s-1"),
    ]
    with pytest.raises(ConflictException):
        await create_issued(test_session, item_rows=rows)


async def test_existing_session_billing_rejected(
    test_session,
    cleanup_db,
):
    row = item_row(related_type="counseling_session", related_session_id="s-1")
    await create_issued(test_session, item_rows=[item_row(**row)])
    with pytest.raises(ConflictException):
        await create_issued(test_session, item_rows=[item_row(**row)])
    # 다른 내담자의 같은 세션(그룹)은 허용
    result = await create_issued(
        test_session, client_id="client-2", item_rows=[item_row(**row)]
    )
    assert result.billable.status == "issued"


# 패키지 선결제 상호배제

async def test_package_blocks_session_billing_and_reverse(
    test_session,
    cleanup_db,
):
    package = item_row(
        item_type="package",
        related_type="counseling_case",
        related_case_id="case-1",
        unit_price=500000,
    )
    session_item = item_row(
        related_type="counseling_session",
        related_case_id="case-1",
        related_session_id="s-1",
    )
    await create_issued(test_session, item_rows=[dict(package)])

    with pytest.raises(ConflictException):  # 패키지 커버 세션 개별 청구 차단
        await create_issued(test_session, item_rows=[dict(session_item)])
    with pytest.raises(ConflictException):  # 중복 패키지 차단
        await create_issued(test_session, item_rows=[dict(package)])
    # 타 내담자는 영향 없음
    other = await create_issued(
        test_session, client_id="client-2", item_rows=[dict(session_item)]
    )
    assert other.billable.status == "issued"


async def test_session_billing_blocks_package(
    test_session,
    cleanup_db,
):
    session_item = item_row(
        related_type="counseling_session",
        related_case_id="case-1",
        related_session_id="s-1",
    )
    package = item_row(
        item_type="package",
        related_type="counseling_case",
        related_case_id="case-1",
        unit_price=500000,
    )
    await create_issued(test_session, item_rows=[dict(session_item)])
    with pytest.raises(ConflictException):
        await create_issued(test_session, item_rows=[dict(package)])


# 납부 반영

PAID_AT = datetime(2026, 7, 9, 12, 0, tzinfo=timezone.utc)


async def pay(session, billable, amount, **kwargs):
    svc = CreatePaymentService(PaymentRepository(session))
    defaults = dict(
        billable_id=billable.id,
        amount=amount,
        payment_method="card",
        paid_at=PAID_AT,
        receipt_number=None,
        memo=None,
        account_id=ACCOUNT,
        billable_status=billable.status,
        billable_unpaid_amount=billable.unpaid_amount,
    )
    defaults.update(kwargs)
    return await svc.execute(**defaults)


async def apply_totals(
    session,
    billable,
):
    total_paid = await PaymentRepository(session).aggregate_by_billable(
        billable_id=billable.id
    )
    _atomic, updated = await ApplyPaymentTotalsService(BillableRepository(session)).execute(
        billable.id, CENTER, total_paid=total_paid, total_amount=billable.total_amount
    )
    return updated


async def test_partial_then_full_payment(
    test_session,
    cleanup_db,
):
    billable = (await create_issued(test_session)).billable

    _, payment = await pay(test_session, billable, 30000)
    assert payment.receipt_number.endswith("-001")  # 자동 발번
    updated = await apply_totals(test_session, billable)
    assert (updated.paid_amount, updated.unpaid_amount, updated.status) == (
        30000, 70000, "issued",
    )

    await pay(test_session, updated, 70000)
    updated = await apply_totals(test_session, billable)
    assert (updated.paid_amount, updated.unpaid_amount, updated.status) == (
        100000, 0, "paid",
    )


async def test_overpayment_rejected(
    test_session,
    cleanup_db,
):
    billable = (await create_issued(test_session)).billable
    with pytest.raises(InvalidOperationException):
        await pay(test_session, billable, 100001)
    with pytest.raises(InvalidOperationException):
        await pay(test_session, billable, 0)


async def test_payment_on_paid_rejected(
    test_session,
    cleanup_db,
):
    billable = (await create_issued(test_session)).billable
    with pytest.raises(InvalidOperationException):
        await pay(test_session, billable, 1000, billable_status="paid")


# 상태전이 · 수정 · 삭제

async def test_complete_is_terminal(
    test_session,
    cleanup_db,
):
    repo = BillableRepository(test_session)
    svc = CompleteBillableService(repo)
    billable = (await create_issued(test_session)).billable

    _, paid = await svc.execute(billable_id=billable.id, center_id=CENTER)
    assert (paid.status, paid.unpaid_amount) == ("paid", 0)
    with pytest.raises(InvalidOperationException):  # paid는 종결 상태 — 재완납 거부
        await svc.execute(billable_id=billable.id, center_id=CENTER)


async def test_update_discount_recalculates_and_flips_status(
    test_session,
    cleanup_db,
):
    billable = (await create_issued(test_session)).billable  # total 100000
    svc = UpdateBillableService(
        BillableRepository(test_session), BillableItemRepository(test_session)
    )

    _, updated = await svc.execute(
        billable_id=billable.id, center_id=CENTER, discount_amount=40000, changed={}
    )
    assert (updated.total_amount, updated.unpaid_amount) == (60000, 60000)

    with pytest.raises(InvalidOperationException):
        await svc.execute(
            billable_id=billable.id, center_id=CENTER,
            discount_amount=100001, changed={},
        )

