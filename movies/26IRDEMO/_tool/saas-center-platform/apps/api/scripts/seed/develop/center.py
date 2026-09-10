"""센터(Center) 픽스처."""
from sqlalchemy import select

from app.modules.center.center.models import Center

from scripts.seed.develop import gen_code, gen_id

CENTER_DATA = {
    "name": "마인드스코프 아동심리상담센터",
    "phone": "02-1234-5678",
    "description": "아동·청소년 심리상담 및 발달검사 전문 센터입니다.",
    "address": {
        "zip_code": "06100",
        "address": "서울특별시 강남구 테헤란로 123",
        "detail": "4층 마인드스코프센터",
    },
    "business_registration_number": "123-45-67890",
    "representative_name": "김원장",
}


async def seed_center(session) -> str:
    """센터 생성. Returns: center_id"""
    print("\n🏢 센터 생성 중...")

    # 기존 센터 확인 — name은 앱에서 수정 가능해 rename 후 재실행 시 중복 센터가 생긴다(실증).
    # 시드 소유 자연키인 사업자번호로 조회, 중복 존재 시 최초 생성분이 정본.
    existing = await session.execute(
        select(Center)
        .where(
            Center.business_registration_number
            == CENTER_DATA["business_registration_number"],
            Center.deleted_at.is_(None),
        )
        .order_by(Center.created_at)
    )
    center = existing.scalars().first()
    if center:
        print(f"  ⏭️  센터 '{center.name}' 이미 존재 (ID: {center.id})")
        return center.id

    center_id = gen_id()
    center = Center(
        id=center_id,
        name=CENTER_DATA["name"],
        code=gen_code(),
        phone=CENTER_DATA["phone"],
        description=CENTER_DATA["description"],
        address=CENTER_DATA["address"],
        business_registration_number=CENTER_DATA["business_registration_number"],
        representative_name=CENTER_DATA["representative_name"],
        is_active=True,
    )
    session.add(center)
    await session.flush()
    print(f"  ✅ '{center.name}' 생성 완료 (Code: {center.code})")
    return center_id
