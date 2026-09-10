"""V1 회귀: consume_sessions 가 락 finder(get_for_update)로 client_voucher 를 읽어
동시 차감을 직렬화한다. 이전엔 find_active(락 없음) → 절대값 쓰기라 double-decrement 위험.
화이트박스 — 락 finder 노출 + 차감 성공만 검증(동시성 자체는 단일 세션 단위 테스트 밖)."""
import inspect

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository
from app.modules.voucher.facade.voucher_facade import VoucherFacade


def test_repository_exposes_for_update_finder():
    names = [n for n, _ in inspect.getmembers(ClientVoucherRepository, inspect.isfunction)]
    assert any(n.endswith("_for_update") for n in names), names


async def test_consume_decrements_via_locking_finder(test_session):
    repo = ClientVoucherRepository(test_session)
    cv = await repo.add(
        center_id="center-A",
        client_id="client-1",
        center_voucher_id="cv-1",
        total_sessions=1,
        remaining_sessions=1,
        created_by="acc-1",
    )

    uow = UnitOfWork(test_session)
    atomics, warnings = await VoucherFacade(uow).consume_sessions(
        center_id="center-A",
        client_id="client-1",
        billable_date=__import__("datetime").date(2026, 6, 24),
        consumption={cv.id: 1},
    )
    await uow.commit()

    assert warnings == []
    assert len(atomics) == 1 and atomics[0].act() == "updated"
    refreshed = await repo.get_by_id(id=cv.id)
    assert refreshed.remaining_sessions == 0
