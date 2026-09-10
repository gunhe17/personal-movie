"""청구(Billable/BillableItem) + 결제(Payment) 픽스처.

완료된 상담/검사 회기를 근거로 청구서를 만든다. 상태 3종을 모두 덮는다:
  - 완납(paid)      C00001 박지우 상담 4회기 → 카드 전액 결제
  - 바우처+완납      C00002 이하준 놀이치료 3회기 → 지원금 차감 후 본인부담 현금 결제
  - 미납(issued)    AC0001 김영희 심리검사 1건 → 결제 없음

금액 규약(create_billable 서비스와 동일):
  total_amount = 정가합 - subsidy - discount, unpaid = total - paid
"""
from datetime import timedelta

from sqlalchemy import select

from app.modules.assessment.assessment_case.models import AssessmentCase
from app.modules.assessment.assessment_session.models import AssessmentSession
from app.modules.billing.billable.models import Billable
from app.modules.billing.billable_item.models import BillableItem
from app.modules.billing.payment.models import Payment
from app.modules.counseling.counseling_case.models import CounselingCase
from app.modules.counseling.counseling_session.models import CounselingSession

from scripts.seed.develop import gen_id, utc_now


async def seed_billing(
    session,
    center_id: str,
    accounts: dict,
    client_map: dict[str, str],
    programs: dict[str, str],
    price_lists: dict[str, str],
    client_vouchers: dict[str, str],
) -> None:
    print("\n🧾 청구서/결제 생성 중...")
    admin_account_id = accounts["admin"][0]
    now = utc_now()

    await _seed_counseling_billable(
        session, center_id, admin_account_id, now,
        case_code="C00001",
        client_id=client_map["박지우"],
        program_id=programs["개인상담"],
        price_list_id=price_lists.get("개인상담"),
        unit_price=80_000,
        subsidy_per_session=0,
        client_voucher_id=None,
        payment=("card", "R-2026-0001", "카드 일시불"),
        memo="9월 개인상담 4회기",
    )

    await _seed_counseling_billable(
        session, center_id, admin_account_id, now,
        case_code="C00002",
        client_id=client_map["이하준"],
        program_id=programs["놀이치료"],
        price_list_id=price_lists.get("놀이치료"),
        unit_price=70_000,
        subsidy_per_session=60_000,
        client_voucher_id=client_vouchers.get("이하준"),
        payment=("cash", "R-2026-0002", "본인부담금 현금 수납"),
        memo="아동비전형성지원서비스 바우처 적용 3회기",
    )

    await _seed_assessment_billable(
        session, center_id, admin_account_id, now,
        client_id=client_map["김영희"],
        price_list_id=price_lists.get("다면적 인성검사 2판"),
        unit_price=90_000,
    )

    await session.flush()


async def _exists(session, center_id: str, client_id: str, memo: str) -> bool:
    row = (await session.execute(
        select(Billable).where(
            Billable.center_id == center_id,
            Billable.client_id == client_id,
            Billable.memo == memo,
            Billable.deleted_at.is_(None),
        )
    )).scalars().first()
    return row is not None


def _add_billable(
    session, *, center_id, client_id, created_by, billable_date, due_date,
    memo, subtotal, subsidy, discount, paid,
):
    total = subtotal - subsidy - discount
    unpaid = total - paid
    billable_id = gen_id()
    session.add(Billable(
        id=billable_id,
        center_id=center_id,
        client_id=client_id,
        created_by=created_by,
        status="paid" if unpaid <= 0 else "issued",
        total_amount=total,
        discount_amount=discount,
        subsidy_amount=subsidy,
        paid_amount=paid,
        unpaid_amount=max(unpaid, 0),
        billable_date=billable_date,
        issued_at=None,
        due_date=due_date,
        memo=memo,
    ))
    return billable_id, total, unpaid


async def _seed_counseling_billable(
    session, center_id, created_by, now, *,
    case_code, client_id, program_id, price_list_id, unit_price,
    subsidy_per_session, client_voucher_id, payment, memo,
):
    if await _exists(session, center_id, client_id, memo):
        print(f"  ⏭️  청구서 '{memo}' 이미 존재")
        return

    case = (await session.execute(
        select(CounselingCase).where(
            CounselingCase.center_id == center_id,
            CounselingCase.case_code == case_code,
            CounselingCase.deleted_at.is_(None),
        )
    )).scalars().first()
    if not case:
        print(f"  ⚠️  케이스 {case_code} 없음 - 청구 스킵")
        return

    sessions = (await session.execute(
        select(CounselingSession)
        .where(
            CounselingSession.counseling_case_id == case.id,
            CounselingSession.status == "completed",
            CounselingSession.deleted_at.is_(None),
        )
        .order_by(CounselingSession.session_number)
    )).scalars().all()
    if not sessions:
        print(f"  ⚠️  {case_code} 완료 회기 없음 - 청구 스킵")
        return

    subtotal = unit_price * len(sessions)
    subsidy = subsidy_per_session * len(sessions)
    billable_date = (now - timedelta(days=3)).date()

    total_paid = subtotal - subsidy
    billable_id, total, unpaid = _add_billable(
        session,
        center_id=center_id, client_id=client_id, created_by=created_by,
        billable_date=billable_date, due_date=billable_date + timedelta(days=14),
        memo=memo, subtotal=subtotal, subsidy=subsidy, discount=0, paid=total_paid,
    )

    item_subsidy = subsidy // len(sessions) if subsidy else 0
    for idx, cs in enumerate(sessions):
        # 마지막 항목이 지원금 배분 나머지를 흡수 (create_billable와 동일 규약)
        allocated = subsidy - item_subsidy * (len(sessions) - 1) if idx == len(sessions) - 1 else item_subsidy
        session.add(BillableItem(
            id=gen_id(),
            billable_id=billable_id,
            item_id=program_id,
            item_type="service",
            related_case_id=case.id,
            related_session_id=cs.id,
            client_voucher_id=client_voucher_id,
            price_list_id=price_list_id,
            related_type="counseling_session",
            quantity=1,
            unit_price=unit_price,
            amount=unit_price,
            subsidy_amount=allocated if subsidy else 0,
            provided_at=cs.completed_at,
            description=f"{case_code} {cs.session_number}회기",
        ))

    method, receipt, pay_memo = payment
    session.add(Payment(
        id=gen_id(),
        billable_id=billable_id,
        created_by=created_by,
        payment_method=method,
        receipt_number=receipt,
        amount=total_paid,
        paid_at=now - timedelta(days=2),
        memo=pay_memo,
    ))
    print(
        f"  ✅ {case_code} 청구 {total:,}원 (정가 {subtotal:,} - 지원금 {subsidy:,}) "
        f"· 결제 {total_paid:,}원 → paid"
    )


async def _seed_assessment_billable(
    session, center_id, created_by, now, *, client_id, price_list_id, unit_price
):
    memo = "MMPI-2 검사 실시 (미납)"
    if await _exists(session, center_id, client_id, memo):
        print(f"  ⏭️  청구서 '{memo}' 이미 존재")
        return

    case = (await session.execute(
        select(AssessmentCase).where(
            AssessmentCase.center_id == center_id,
            AssessmentCase.case_code == "AC0001",
            AssessmentCase.deleted_at.is_(None),
        )
    )).scalars().first()
    if not case:
        print("  ⚠️  검사 케이스 AC0001 없음 - 청구 스킵")
        return

    attended = (await session.execute(
        select(AssessmentSession).where(
            AssessmentSession.case_id == case.id,
            AssessmentSession.status == "attended",
            AssessmentSession.deleted_at.is_(None),
        )
    )).scalars().first()

    billable_date = (now - timedelta(days=5)).date()
    billable_id, total, unpaid = _add_billable(
        session,
        center_id=center_id, client_id=client_id, created_by=created_by,
        billable_date=billable_date, due_date=billable_date + timedelta(days=14),
        memo=memo, subtotal=unit_price, subsidy=0, discount=0, paid=0,
    )
    session.add(BillableItem(
        id=gen_id(),
        billable_id=billable_id,
        item_id=None,
        item_type="service",
        related_case_id=case.id,
        related_session_id=attended.id if attended else None,
        client_voucher_id=None,
        price_list_id=price_list_id,
        related_type="assessment_session",
        quantity=1,
        unit_price=unit_price,
        amount=unit_price,
        subsidy_amount=0,
        provided_at=now - timedelta(days=7),
        description="AC0001 다면적 인성검사 2판(MMPI-2)",
    ))
    print(f"  ✅ AC0001 청구 {total:,}원 · 미납 {unpaid:,}원 → issued")
