"""가격표(PriceList) 픽스처 — 상담 프로그램 + 자주 쓰는 심리검사."""
from sqlalchemy import select

from app.modules.assessment.assessment.models import Assessment
from app.modules.billing.price_list.models import PriceList

from scripts.seed.develop import gen_id

# 검사 code → 단가
ASSESSMENT_PRICES = {
    "MMPI_2": 90_000,
    "K_WISC_IV": 150_000,
    "HTP": 60_000,
    "SCT": 50_000,
}


async def seed_price_lists(
    session, center_id: str, accounts: dict, programs: dict[str, str]
) -> dict[str, str]:
    """상담 프로그램 + 검사 가격표 생성. Returns: {service_name: price_list_id}"""
    print("\n💰 가격표 생성 중...")
    admin_account_id = accounts["admin"][0]
    result: dict[str, str] = {}

    rows: list[tuple[str, str, str | None, int, str]] = []

    # 상담 — 프로그램 연동(source=synced)
    for name, price in (("개인상담", 80_000), ("놀이치료", 70_000)):
        program_id = programs.get(name)
        if program_id:
            rows.append(("counseling", name, program_id, price, "synced"))

    # 검사 — 카탈로그 연동
    for code, price in ASSESSMENT_PRICES.items():
        assessment = (await session.execute(
            select(Assessment).where(
                Assessment.code == code, Assessment.deleted_at.is_(None)
            )
        )).scalars().first()
        if assessment:
            rows.append(("assessment", assessment.kor_name, assessment.id, price, "manual"))

    for service_type, service_name, reference_id, unit_price, source in rows:
        existing = (await session.execute(
            select(PriceList).where(
                PriceList.center_id == center_id,
                PriceList.service_name == service_name,
                PriceList.deleted_at.is_(None),
            )
        )).scalars().first()
        if existing:
            result[service_name] = existing.id
            print(f"  ⏭️  {service_name} 이미 존재")
            continue

        pl_id = gen_id()
        session.add(PriceList(
            id=pl_id,
            center_id=center_id,
            reference_id=reference_id,
            created_by=admin_account_id,
            service_type=service_type,
            source=source,
            service_name=service_name,
            unit_price=unit_price,
            is_active=True,
        ))
        result[service_name] = pl_id
        print(f"  ✅ [{service_type}] {service_name} {unit_price:,}원")

    await session.flush()
    return result
