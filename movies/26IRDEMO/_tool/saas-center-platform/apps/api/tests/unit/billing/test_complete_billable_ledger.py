"""B1 회귀: 완납 처리 시 머니 원장(paid_amount/unpaid_amount)이 정합되어야 한다.
이전엔 status 만 바뀌어 완납 표시인데 미수금이 남고 이후 결제로 회수 불가했다."""
from datetime import date

from app.modules.billing.billable.repository import BillableRepository
from app.modules.billing.billable.services.complete_billable import (
    CompleteBillableService,
)


async def test_complete_reconciles_ledger(test_session):
    repo = BillableRepository(test_session)
    billable = await repo.add(
        center_id="center-1",
        client_id="client-1",
        billable_date=date.today(),
        status="issued",
        created_by="admin-1",
        total_amount=100000,
        paid_amount=0,
        unpaid_amount=100000,
    )

    svc = CompleteBillableService(repo)
    _atomic, updated = await svc.execute(
        billable_id=billable.id, center_id="center-1"
    )

    assert updated.status == "paid"
    assert updated.paid_amount == 100000
    assert updated.unpaid_amount == 0
