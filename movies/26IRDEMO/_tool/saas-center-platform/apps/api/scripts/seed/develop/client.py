"""내담자/보호자(Client) 픽스처."""
from datetime import date

from sqlalchemy import select

from app.modules.client.profile.models import Client

from scripts.seed.develop import gen_code, gen_id

# 시나리오:
#   - 김민준(아동, 7세) + 김영희(엄마, both) + 김철수(아빠, guardian)
#   - 김서연(아동, 5세) = 김민준의 여동생, 같은 부모
#   - 이하준(아동, 10세) + 이수진(엄마, guardian)
#   - 박지우(성인 내담자, 35세) = 보호자 없는 성인
CLIENTS = [
    # --- 가족 1: 김씨 가족 ---
    {
        "key": "김민준",
        "name": "김민준",
        "role": "client",
        "birth_date": date(2019, 3, 10),
        "gender": "male",
        "phone": None,
        "status": "active",
        "memo": "ADHD 의심, 집중력 문제로 내원",
    },
    {
        "key": "김영희",
        "name": "김영희",
        "role": "both",
        "birth_date": date(1990, 8, 25),
        "gender": "female",
        "phone": "010-2000-0001",
        "status": "active",
        "memo": "김민준·김서연의 어머니. 본인도 양육 스트레스 상담 중",
    },
    {
        "key": "김철수",
        "name": "김철수",
        "role": "guardian",
        "birth_date": date(1988, 12, 3),
        "gender": "male",
        "phone": "010-2000-0002",
        "status": "active",
        "memo": "김민준·김서연의 아버지",
    },
    {
        "key": "김서연",
        "name": "김서연",
        "role": "client",
        "birth_date": date(2021, 6, 15),
        "gender": "female",
        "phone": None,
        "status": "active",
        "memo": "언어발달 지연 평가 의뢰",
    },
    # --- 가족 2: 이씨 가족 ---
    {
        "key": "이하준",
        "name": "이하준",
        "role": "client",
        "birth_date": date(2016, 9, 22),
        "gender": "male",
        "phone": None,
        "status": "active",
        "memo": "학교 적응 문제, 또래관계 어려움",
    },
    {
        "key": "이수진",
        "name": "이수진",
        "role": "guardian",
        "birth_date": date(1985, 4, 18),
        "gender": "female",
        "phone": "010-3000-0001",
        "status": "active",
        "memo": "이하준의 어머니. 한부모 가정",
    },
    # --- 성인 내담자 ---
    {
        "key": "박지우",
        "name": "박지우",
        "role": "client",
        "birth_date": date(1991, 2, 14),
        "gender": "female",
        "phone": "010-4000-0001",
        "status": "active",
        "memo": "우울감, 직장 스트레스 상담",
    },
]


async def seed_clients(session, center_id: str) -> dict[str, str]:
    """내담자/보호자 생성. Returns: {key: client_id}"""
    print("\n🧒 내담자/보호자 생성 중...")
    result = {}

    for client_data in CLIENTS:
        key = client_data["key"]

        # 중복 확인 (이름 + center_id 기준)
        existing = await session.execute(
            select(Client).where(
                Client.center_id == center_id,
                Client.name == client_data["name"],
                Client.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none():
            client = (await session.execute(
                select(Client).where(
                    Client.center_id == center_id,
                    Client.name == client_data["name"],
                    Client.deleted_at.is_(None),
                )
            )).scalar_one()
            result[key] = client.id
            print(f"  ⏭️  {key} ({client_data['role']}) 이미 존재")
            continue

        client_id = gen_id()
        client = Client(
            id=client_id,
            center_id=center_id,
            code=gen_code(),
            name=client_data["name"],
            role=client_data["role"],
            birth_date=client_data.get("birth_date"),
            gender=client_data.get("gender"),
            phone=client_data.get("phone"),
            status=client_data.get("status", "active"),
            memo=client_data.get("memo"),
        )
        session.add(client)
        result[key] = client_id

        role_badge = {"client": "내담자", "guardian": "보호자", "both": "보호자+내담자"}
        print(f"  ✅ {key} [{role_badge[client_data['role']]}]")

    await session.flush()
    return result
