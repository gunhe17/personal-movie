"""센터 바우처(CenterVoucher) + 내담자 바우처(ClientVoucher) 픽스처.

common `voucher.py` 카탈로그(경기도 지역사회서비스)를 센터가 채택한 형태.
"""
from datetime import date

from sqlalchemy import select

from app.modules.voucher.center_voucher.models import CenterVoucher
from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.voucher.models import Voucher

from scripts.seed.develop import gen_id

# 카탈로그명 → 센터 채택 조건 (회기수, 회당 단가 = 정부지원 + 본인부담)
CENTER_VOUCHERS = {
    "우리아이심리지원서비스": {"sessions": 12, "unit_price": 160_000},
    "아동비전형성지원서비스": {"sessions": 12, "unit_price": 200_000},
}

# 내담자 key → (카탈로그명, 총회기, 사용회기)
CLIENT_VOUCHERS = [
    ("이하준", "아동비전형성지원서비스", 12, 3),
    ("김민준", "우리아이심리지원서비스", 12, 0),
]


async def seed_vouchers(
    session, center_id: str, accounts: dict, client_map: dict[str, str]
) -> dict[str, str]:
    """센터/내담자 바우처 생성. Returns: {내담자 key: client_voucher_id}"""
    print("\n🎟️  센터/내담자 바우처 생성 중...")
    admin_account_id = accounts["admin"][0]

    center_voucher_ids: dict[str, str] = {}
    for name, spec in CENTER_VOUCHERS.items():
        catalog = (await session.execute(
            select(Voucher).where(Voucher.name == name, Voucher.deleted_at.is_(None))
        )).scalars().first()
        if not catalog:
            print(f"  ⚠️  카탈로그 '{name}' 없음 (common 시드 선행 필요) - 스킵")
            continue

        cv = (await session.execute(
            select(CenterVoucher).where(
                CenterVoucher.center_id == center_id,
                CenterVoucher.catalog_id == catalog.id,
                CenterVoucher.deleted_at.is_(None),
            )
        )).scalars().first()
        if cv:
            center_voucher_ids[name] = cv.id
            print(f"  ⏭️  센터 바우처 '{name}' 이미 존재")
            continue

        cv_id = gen_id()
        session.add(CenterVoucher(
            id=cv_id,
            center_id=center_id,
            catalog_id=catalog.id,
            created_by=admin_account_id,
            default_total_sessions=spec["sessions"],
            unit_price=spec["unit_price"],
            is_active=True,
        ))
        center_voucher_ids[name] = cv_id
        print(f"  ✅ 센터 바우처 '{name}' ({spec['sessions']}회기 · 회당 {spec['unit_price']:,}원)")

    await session.flush()

    result: dict[str, str] = {}
    today = date.today()
    for client_key, catalog_name, total, used in CLIENT_VOUCHERS:
        client_id = client_map.get(client_key)
        center_voucher_id = center_voucher_ids.get(catalog_name)
        if not client_id or not center_voucher_id:
            print(f"  ⚠️  {client_key} / '{catalog_name}' 준비 안 됨 - 스킵")
            continue

        existing = (await session.execute(
            select(ClientVoucher).where(
                ClientVoucher.client_id == client_id,
                ClientVoucher.center_voucher_id == center_voucher_id,
                ClientVoucher.deleted_at.is_(None),
            )
        )).scalars().first()
        if existing:
            result[client_key] = existing.id
            print(f"  ⏭️  {client_key} 바우처 이미 존재")
            continue

        unit_price = CENTER_VOUCHERS[catalog_name]["unit_price"]
        cv_id = gen_id()
        session.add(ClientVoucher(
            id=cv_id,
            center_id=center_id,
            client_id=client_id,
            center_voucher_id=center_voucher_id,
            created_by=admin_account_id,
            total_sessions=total,
            remaining_sessions=total - used,
            total_amount=total * unit_price,
            remaining_amount=(total - used) * unit_price,
            valid_from=date(today.year, 1, 1),
            valid_until=date(today.year, 12, 31),
        ))
        result[client_key] = cv_id
        print(f"  ✅ {client_key} ← '{catalog_name}' ({total - used}/{total}회기 잔여)")

    await session.flush()
    return result
