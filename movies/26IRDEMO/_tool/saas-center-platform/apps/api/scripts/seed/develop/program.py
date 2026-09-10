"""상담 프로그램(Program) 픽스처."""
from sqlalchemy import select

from app.modules.center.program.models import Program

from scripts.seed.develop import gen_id


async def seed_programs(session, center_id: str) -> dict[str, str]:
    """상담 프로그램 생성. Returns: {name: program_id}"""
    print("\n📋 상담 프로그램 생성 중...")

    programs_data = [
        {"name": "개인상담", "type": "INDIVIDUAL", "price": 80000, "duration": 50, "desc": "1:1 개인 심리상담"},
        {"name": "놀이치료", "type": "INDIVIDUAL", "price": 70000, "duration": 40, "desc": "아동 대상 놀이치료"},
    ]

    result = {}
    for p in programs_data:
        existing = await session.execute(
            select(Program).where(
                Program.center_id == center_id,
                Program.name == p["name"],
                Program.deleted_at.is_(None),
            )
        )
        prog = existing.scalar_one_or_none()
        if prog:
            result[p["name"]] = prog.id
            print(f"  ⏭️  {p['name']} 이미 존재")
            continue

        prog_id = gen_id()
        prog = Program(
            id=prog_id,
            center_id=center_id,
            name=p["name"],
            description=p["desc"],
            program_type=p["type"],
            price=p["price"],
            duration_minutes=p["duration"],
            is_active=True,
        )
        session.add(prog)
        result[p["name"]] = prog_id
        print(f"  ✅ {p['name']} ({p['type']}, {p['duration']}분, {p['price']:,}원)")

    await session.flush()
    return result
